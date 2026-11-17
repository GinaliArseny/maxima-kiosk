/**
 * Добавить пользователя админки или сменить ему пароль:
 *   docker compose exec admin node user.mjs <логин>
 * Пароль спрашивается дважды и не отображается.
 */
import { stdin, stdout } from 'node:process';
import { addUser } from './auth';

function ask(prompt: string): Promise<string> {
  return new Promise((done) => {
    stdout.write(prompt);
    let input = '';
    const tty = stdin.isTTY;
    if (tty) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.off('data', onData);
          if (tty) stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          return done(input);
        }
        if (c === '\u0003') process.exit(130);
        input = c === '\u007f' ? input.slice(0, -1) : input + c;
      }
    };
    stdin.on('data', onData);
  });
}

const login = process.argv[2];
if (!login) {
  console.error('Использование: user.mjs <логин>');
  process.exit(1);
}
const file = process.env.USERS_FILE ?? '/admin-data/users.json';
const p1 = await ask(`Пароль для ${login}: `);
const p2 = await ask('Ещё раз: ');
if (p1 !== p2) {
  console.error('Пароли не совпадают');
  process.exit(1);
}
await addUser(file, login, p1);
console.log(`✓ Пользователь ${login} сохранён в ${file}`);
