import * as auth from '@/lib/auth.js';
import * as landing from '@/lib/landing.js';
import * as policy from '@/lib/policy.js';
import * as i18n from '@/i18n/index.js';
import { requireAdmin, adminMetadata, sessionCookie } from '@/lib/admin.js';
import LandingEditor from './LandingEditor.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Нүүр хуудас');
}

export default async function LandingPage() {
  await requireAdmin();
  const defaults = i18n.translator();
  const sections = landing.SECTIONS.map((s) => ({
    ...s,
    fields: s.fields.map((f) => ({ ...f, value: landing.fieldValue(f, defaults) ?? '' })),
  }));
  const slots = Object.fromEntries(
    Object.entries(landing.IMAGE_SLOTS).map(([slot, cfg]) => [
      slot,
      { label: cfg.label, hint: cfg.hint, large: cfg.large, small: cfg.small || '', crop: cfg.crop || '', img: landing.image(slot), custom: landing.isCustomImage(slot) },
    ])
  );

  return (
    <>
      <div className="a-head">
        <h1>Нүүр хуудас</h1>
        <div className="a-head-actions">
          <a className="a-btn" href="/" target="_blank" rel="noopener">
            Сайтаас харах ↗
          </a>
        </div>
      </div>
      <p className="muted">
        Сайтын нүүр хуудсанд харагдах текст, зургийг дээрээс доош дарааллаар нь засна. Текстээ засаад доод талын <strong>Хадгалах</strong> товчийг дарна.
        Сонгосон зураг тэр дороо хадгалагдах бөгөөд утсанд хурдан ачаалахаар автоматаар шахагдана.
      </p>

      <LandingEditor
        sections={sections}
        slots={slots}
        gallery={landing.gallery()}
        gallerySizes={landing.GALLERY_SIZES}
        galleryMax={landing.GALLERY_MAX}
        policy={policy.get()}
        policyTones={policy.TONES}
        policyMax={{ highlight: policy.MAX_HIGHLIGHTS, section: policy.MAX_SECTIONS }}
        csrf={auth.csrfToken(await sessionCookie())}
      />
    </>
  );
}
