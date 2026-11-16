import { z } from 'zod';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const nonEmpty = z.string().trim().min(1);

const weekHours = z.object(
  Object.fromEntries(WEEKDAYS.map((d) => [d, nonEmpty.nullable()])) as Record<Weekday, z.ZodNullable<typeof nonEmpty>>,
);

export const clinicSchema = z.object({
  demo: z.boolean().optional(),
  shortName: nonEmpty,
  legalName: nonEmpty,
  addresses: z.array(z.object({ address: nonEmpty, hours: weekHours })).min(1),
  legalAddress: nonEmpty,
  ogrn: nonEmpty,
  inn: nonEmpty,
  kpp: nonEmpty.optional(),
  email: nonEmpty,
  site: z.string().url(),
  phones: z.array(z.object({ label: nonEmpty, number: nonEmpty })),
  postalAddress: nonEmpty.optional(),
  chiefDoctor: z.object({ fullName: nonEmpty, phone: nonEmpty.optional(), receptionHours: nonEmpty.optional() }),
  recordsRoomHours: nonEmpty.optional(),
  license: z.object({
    number: nonEmpty,
    date: nonEmpty,
    issuer: nonEmpty.optional(),
    validity: nonEmpty.optional(),
    docId: nonEmpty.optional(),
  }),
  suspension: z
    .object({
      active: z.boolean(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      text: nonEmpty,
    })
    .optional(),
  gameUrl: z.string().url().optional(),
  priceDocId: nonEmpty.optional(),
});

export const credentialSchema = z.object({
  kind: nonEmpty,
  series: nonEmpty.optional(),
  number: nonEmpty.optional(),
  issuedAt: nonEmpty.optional(),
  institution: nonEmpty.optional(),
  specialization: nonEmpty.optional(),
  validUntil: nonEmpty.optional(),
  uniqueNumber: nonEmpty.optional(),
  /** Сведения дословно из источника (сайт клиники) — вместо разобранных полей. */
  details: nonEmpty.optional(),
});

export const doctorSchema = z.object({
  id: nonEmpty,
  fullName: nonEmpty,
  specialty: nonEmpty,
  photo: nonEmpty.optional(),
  credentials: z.array(credentialSchema),
  schedule: z.object(
    Object.fromEntries(WEEKDAYS.map((d) => [d, nonEmpty.optional()])) as Record<Weekday, z.ZodOptional<typeof nonEmpty>>,
  ),
});

const legalRefs = z.array(z.number().int().min(1).max(28));
const base = { id: nonEmpty, title: nonEmpty, legalRefs };

export const docItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pdf'), ...base, file: nonEmpty }),
  z.object({ kind: z.literal('link'), ...base, url: z.string().url() }),
  z.object({ kind: z.literal('text'), ...base, body: nonEmpty }),
  z.object({ kind: z.literal('notice'), ...base, body: nonEmpty }),
]);

export const docSectionSchema = z.object({
  id: nonEmpty,
  screen: z.enum(['documents', 'rights']),
  title: nonEmpty,
  items: z.array(docItemSchema),
});

export const authoritySchema = z.object({
  name: nonEmpty,
  address: nonEmpty.optional(),
  phone: nonEmpty,
  site: z.string().url().optional(),
});

export const fileSchemas = {
  'clinic.json': clinicSchema,
  'doctors.json': z.array(doctorSchema),
  'documents.json': z.array(docSectionSchema),
  'authorities.json': z.array(authoritySchema),
} as const;

export type Clinic = z.infer<typeof clinicSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type Doctor = z.infer<typeof doctorSchema>;
export type DocItem = z.infer<typeof docItemSchema>;
export type DocSection = z.infer<typeof docSectionSchema>;
export type Authority = z.infer<typeof authoritySchema>;

export interface KioskData {
  clinic: Clinic;
  doctors: Doctor[];
  sections: DocSection[];
  authorities: Authority[];
}
