import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { existsSync } from 'node:fs';
import { EDITABLE_FILES, type EditableFile } from '../../src/data/schema';
import { checkPassword, SESSION_TTL_MS, Sessions } from './auth';
import { ConflictError, ContentStore, ValidationError } from './contentStore';
import { MAX_PDF_BYTES, savePdf, savePhoto } from './uploads';

export interface AppOptions {
  contentRoot: string;
  usersFile: string;
  /** Собранная веб-админка (admin/web/dist); без неё — только API. */
  webDir?: string;
  /** Cookie только по HTTPS (за nginx — да). */
  secure?: boolean;
}

const COOKIE = 'ka_sid';
const isFile = (f: string): f is EditableFile => Object.hasOwn(EDITABLE_FILES, f);

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  // За nginx ровно один прокси: req.ip — адрес, который дописал nginx, а не присланный клиентом.
  const app = Fastify({ trustProxy: (_addr: string, hop: number) => hop < 1, bodyLimit: 5 * 1024 * 1024 });
  const store = new ContentStore(opts.contentRoot);
  await store.ensureVersion();
  const sessions = new Sessions();

  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: MAX_PDF_BYTES + 1024 * 1024, files: 1 } });

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Robots-Tag', 'noindex, nofollow');
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ValidationError) return reply.code(422).send({ issues: err.issues });
    if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
    if ((err as { statusCode?: number }).statusCode === 429)
      return reply.code(429).send({ error: 'Слишком много попыток — подождите минуту' });
    if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE')
      return reply.code(422).send({ issues: [{ path: 'file', message: 'Файл слишком большой' }] });
    app.log.error(err);
    return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({ error: 'Ошибка сервера' });
  });

  await app.register(
    async (admin) => {
      const user = (req: FastifyRequest) => sessions.get(req.cookies[COOKIE]);
      const requireUser = async (req: FastifyRequest, reply: FastifyReply) => {
        if (!user(req)) return reply.code(401).send({ error: 'Нужно войти' });
      };

      admin.post<{ Body: { login?: string; password?: string } }>(
        '/api/login',
        { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
        async (req, reply) => {
          const { login = '', password = '' } = req.body ?? {};
          if (!(await checkPassword(opts.usersFile, login, password)))
            return reply.code(401).send({ error: 'Неверный логин или пароль' });
          reply.setCookie(COOKIE, sessions.create(login), {
            httpOnly: true,
            sameSite: 'strict',
            secure: opts.secure ?? false,
            path: '/admin',
            maxAge: SESSION_TTL_MS / 1000,
          });
          return reply.code(204).send();
        },
      );

      admin.register(async (api) => {
        api.addHook('preHandler', requireUser);
        api.addHook('onSend', async (_req, reply) => {
          reply.header('Cache-Control', 'no-store');
        });

        api.post('/api/logout', async (req, reply) => {
          sessions.drop(req.cookies[COOKIE]);
          reply.clearCookie(COOKIE, { path: '/admin' });
          return reply.code(204).send();
        });
        api.get('/api/me', async (req) => ({ login: user(req) }));

        api.get<{ Params: { file: string } }>('/api/content/:file', async (req, reply) => {
          if (!isFile(req.params.file)) return reply.code(404).send({ error: 'Нет такого раздела' });
          return store.read(req.params.file);
        });
        api.put<{ Params: { file: string }; Body: { data: unknown; baseVersion: string } }>(
          '/api/content/:file',
          async (req, reply) => {
            if (!isFile(req.params.file)) return reply.code(404).send({ error: 'Нет такого раздела' });
            return store.save(req.params.file, req.body.data, req.body.baseVersion, user(req)!);
          },
        );

        api.post<{ Params: { kind: string }; Querystring: { hint?: string } }>('/api/upload/:kind', async (req, reply) => {
          const { kind } = req.params;
          if (kind !== 'pdf' && kind !== 'photo') return reply.code(404).send({ error: 'Нет такого вида загрузки' });
          const part = await req.file();
          if (!part) throw new ValidationError([{ path: 'file', message: 'Файл не выбран' }]);
          const buf = await part.toBuffer();
          const hint = req.query.hint ?? part.filename ?? 'file';
          const file = kind === 'pdf' ? await savePdf(opts.contentRoot, buf, hint) : await savePhoto(opts.contentRoot, buf, hint);
          return { file };
        });

        api.get('/api/history', async () => store.history());
        api.post<{ Params: { id: string } }>('/api/history/:id/restore', async (req, reply) => {
          if (!/^[\w-]+$/.test(req.params.id)) return reply.code(404).send({ error: 'Нет такой версии' });
          await store.restore(req.params.id, user(req)!);
          return reply.code(204).send();
        });
        api.get('/api/coverage', async () => store.coverage());
      });

      if (opts.webDir && existsSync(opts.webDir)) {
        await admin.register(fastifyStatic, { root: opts.webDir, prefix: '/', wildcard: false });
        admin.get('/*', (req, reply) => {
          if (req.url.startsWith('/admin/api/')) return reply.code(404).send({ error: 'Нет такого адреса' });
          return reply.sendFile('index.html');
        });
      }
    },
    { prefix: '/admin' },
  );

  // С собранной админкой @fastify/static сам отдаёт index.html и на /admin, и на /admin/.
  if (!opts.webDir || !existsSync(opts.webDir)) app.get('/admin', (_req, reply) => reply.redirect('/admin/'));
  return app;
}
