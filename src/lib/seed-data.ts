import type { DbAdapter } from './db';
import { DEFAULT_ROLES } from './permissions';
import { DEFAULT_SITE_SETTINGS } from './settings';
import { createId } from './security';

/** Seed only non-personal, replaceable system configuration. Admin accounts are bootstrapped separately. */
export async function seedDatabase(db: DbAdapter): Promise<void> {
  await db.transaction(async (tx) => {
    for (const role of DEFAULT_ROLES) {
      await tx.query(
        `INSERT INTO roles (id, slug, name_sw, name_en, description_sw, description_en, permissions, is_system)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
         ON CONFLICT (slug) DO NOTHING`,
        [
          role.id,
          role.slug,
          role.name_sw,
          role.name_en,
          role.description_sw,
          role.description_en,
          JSON.stringify(role.permissions),
          role.is_system,
        ]
      );
    }

    for (const [key, value] of Object.entries(DEFAULT_SITE_SETTINGS)) {
      await tx.query(
        `INSERT INTO site_settings (key, value_json, group_name)
         VALUES ($1, $2::jsonb, $1) ON CONFLICT (key) DO NOTHING`,
        [key, JSON.stringify(value)]
      );
    }

    const categories = [
      ['press-release', 'publication', 'Taarifa kwa Vyombo vya Habari', 'Press Releases'],
      ['annual-report', 'publication', 'Ripoti za Mwaka', 'Annual Reports'],
      ['policy', 'publication', 'Sera na Miongozo', 'Policies & Guidelines'],
      ['corporate-activity', 'event', 'Shughuli za Shirika', 'Corporate Activities'],
      ['announcement', 'article', 'Matangazo ya Taasisi', 'Institutional Announcements'],
      ['behind-scenes', 'article', 'Nyuma ya Pazia', 'Behind the Scenes'],
    ];
    for (const [slug, module, sw, en] of categories) {
      await tx.query(
        `INSERT INTO categories (id, slug, module, name_sw, name_en)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (module, slug) DO NOTHING`,
        [createId('cat'), slug, module, sw, en]
      );
    }
  });
}
