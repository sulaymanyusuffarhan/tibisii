export const ALL_PERMISSIONS = [
  // Dashboard & Analytics
  { key: 'dashboard.view', group: 'Dashboard & Reports', label: 'View Admin Dashboard' },
  { key: 'analytics.view', group: 'Dashboard & Reports', label: 'View Analytics & Export Reports' },
  { key: 'compliance.view', group: 'Dashboard & Reports', label: 'View Compliance & Security Checklists' },

  // Editorial Content (Articles, Behind the Scenes, Community, Hospitality, Achievements, Partnerships, Videos)
  { key: 'content.view', group: 'Editorial Content', label: 'View Editorial Content' },
  { key: 'content.create', group: 'Editorial Content', label: 'Create Articles & Submit for Review' },
  { key: 'content.edit_own', group: 'Editorial Content', label: 'Edit Own Draft/Returned Content' },
  { key: 'content.edit_any', group: 'Editorial Content', label: 'Edit Any Department Content' },
  { key: 'content.review', group: 'Editorial Content', label: 'Editor Review & Request Changes' },
  { key: 'content.approve', group: 'Editorial Content', label: 'Department Head Approval / Rejection' },
  { key: 'content.publish', group: 'Editorial Content', label: 'Publish, Schedule, Unpublish & Archive' },
  { key: 'content.delete', group: 'Editorial Content', label: 'Delete Editorial Content' },

  // Publications & Documents
  { key: 'publications.view', group: 'Publications & Documents', label: 'View Publications Library' },
  { key: 'publications.manage', group: 'Publications & Documents', label: 'Create, Edit & Upload Publications' },
  { key: 'publications.approve', group: 'Publications & Documents', label: 'Approve & Publish Publications' },
  { key: 'publications.delete', group: 'Publications & Documents', label: 'Delete Publications' },

  // Events
  { key: 'events.view', group: 'Events', label: 'View Institutional Events' },
  { key: 'events.manage', group: 'Events', label: 'Create & Edit Events' },
  { key: 'events.publish', group: 'Events', label: 'Approve & Publish Events' },
  { key: 'events.delete', group: 'Events', label: 'Delete Events' },

  // Institutional Profiles & Services
  { key: 'profiles.view', group: 'Profiles & Services', label: 'View Leadership, Personnel & Offices' },
  { key: 'profiles.manage', group: 'Profiles & Services', label: 'Manage Leadership, Team Spotlight & Regional Offices' },
  { key: 'services.manage', group: 'Profiles & Services', label: 'Manage Radio, TV, Digital Channels & Schedules' },
  { key: 'faq.manage', group: 'Profiles & Services', label: 'Manage FAQs' },

  // Media Library
  { key: 'media.view', group: 'Media Library', label: 'Browse Media Library' },
  { key: 'media.upload', group: 'Media Library', label: 'Upload Approved Media Files' },
  { key: 'media.manage', group: 'Media Library', label: 'Edit Captions, Replace Files & Manage Galleries' },
  { key: 'media.delete', group: 'Media Library', label: 'Delete Media Files' },

  // Pages, Homepage & Navigation
  { key: 'pages.view', group: 'Pages & Site Design', label: 'View Institutional Pages' },
  { key: 'pages.manage', group: 'Pages & Site Design', label: 'Create & Edit Pages, Homepage & Menus' },
  { key: 'pages.publish', group: 'Pages & Site Design', label: 'Publish Pages & Homepage Configuration' },
  { key: 'taxonomy.manage', group: 'Pages & Site Design', label: 'Manage Categories & Tags' },

  // Public Enquiries & Stakeholder Moderation
  { key: 'enquiries.view', group: 'Enquiries & Moderation', label: 'View Public Enquiries & Testimonials' },
  { key: 'enquiries.manage', group: 'Enquiries & Moderation', label: 'Assign, Respond, Export & Archive Enquiries' },
  { key: 'testimonials.moderate', group: 'Enquiries & Moderation', label: 'Moderate & Publish Stakeholder Testimonials' },

  // System Administration & Governance
  { key: 'users.manage', group: 'System & Security', label: 'Manage Users, Accounts & MFA Reset' },
  { key: 'roles.manage', group: 'System & Security', label: 'Configure Roles & Permissions' },
  { key: 'settings.manage', group: 'System & Security', label: 'Manage Website Settings & Workflow Rules' },
  { key: 'audit.view', group: 'System & Security', label: 'Access Security & Administrative Audit Logs' },
  { key: 'backups.manage', group: 'System & Security', label: 'Create, Download & Restore Database Backups' },
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number]['key'];

export const WORKFLOW_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'rejected',
  'archived',
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_LABELS: Record<WorkflowStatus, { sw: string; en: string; color: string }> = {
  draft: { sw: 'Rasimu', en: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  submitted: { sw: 'Imewasilishwa', en: 'Submitted', color: 'bg-sky-50 text-sky-800 border-sky-300' },
  under_review: { sw: 'Inahakikiwa', en: 'Under Review', color: 'bg-amber-50 text-amber-800 border-amber-300' },
  changes_requested: { sw: 'Marekebisho Yanahitajika', en: 'Changes Requested', color: 'bg-orange-50 text-orange-800 border-orange-300' },
  approved: { sw: 'Imeidhinishwa', en: 'Approved', color: 'bg-teal-50 text-teal-800 border-teal-300' },
  scheduled: { sw: 'Imepangwa Kuchapishwa', en: 'Scheduled', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' },
  published: { sw: 'Imechapishwa', en: 'Published', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  rejected: { sw: 'Imekataliwa', en: 'Rejected', color: 'bg-rose-50 text-rose-800 border-rose-300' },
  archived: { sw: 'Imehifadhiwa Kumbukumbu', en: 'Archived', color: 'bg-stone-100 text-stone-700 border-stone-300' },
};

export interface WorkflowRules {
  require_editor_review: boolean;
  require_director_approval: boolean;
  allow_delegated_approval: boolean;
}

export function hasPermission(
  userPermissions: string[],
  roleSlug: string,
  required: PermissionKey | PermissionKey[]
): boolean {
  if (roleSlug === 'super_admin') return true;
  const reqs = Array.isArray(required) ? required : [required];
  return reqs.some((p) => userPermissions.includes(p));
}

export function canExecuteWorkflowTransition(params: {
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  permissions: string[];
  roleSlug: string;
  delegatedPublish: boolean;
  isOwner: boolean;
  domain: 'content' | 'publications' | 'events' | 'pages';
  rules?: WorkflowRules;
}): { allowed: boolean; reason?: string } {
  const { fromStatus, toStatus, permissions, roleSlug, delegatedPublish, isOwner, domain, rules } = params;

  if (roleSlug === 'super_admin') return { allowed: true };

  const has = (p: PermissionKey) => permissions.includes(p);
  const canApprove =
    has('content.approve') ||
    (domain === 'publications' && has('publications.approve')) ||
    (domain === 'events' && has('events.publish')) ||
    (domain === 'pages' && has('pages.publish')) ||
    (delegatedPublish && (rules?.allow_delegated_approval ?? true));

  const canPublish =
    has('content.publish') ||
    (domain === 'publications' && has('publications.approve')) ||
    (domain === 'events' && has('events.publish')) ||
    (domain === 'pages' && has('pages.publish')) ||
    (delegatedPublish && (rules?.allow_delegated_approval ?? true));

  const canReview =
    has('content.review') ||
    canApprove ||
    (domain === 'publications' && has('publications.manage')) ||
    (domain === 'events' && has('events.manage')) ||
    (domain === 'pages' && has('pages.manage'));

  const canCreateOrEditOwn =
    has('content.create') ||
    (isOwner && has('content.edit_own')) ||
    has('content.edit_any') ||
    (domain === 'publications' && has('publications.manage')) ||
    (domain === 'events' && has('events.manage')) ||
    (domain === 'pages' && has('pages.manage'));

  switch (toStatus) {
    case 'draft':
      if (canCreateOrEditOwn && (isOwner || canReview || canApprove)) return { allowed: true };
      return { allowed: false, reason: 'Insufficient permission to save as draft.' };

    case 'submitted':
      if (
        canCreateOrEditOwn &&
        ['draft', 'changes_requested', 'rejected', 'submitted'].includes(fromStatus)
      ) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only draft or returned content may be submitted for review.' };

    case 'under_review':
    case 'changes_requested':
      if (canReview) return { allowed: true };
      return { allowed: false, reason: 'Editor or reviewer authorization is required.' };

    case 'approved':
    case 'rejected':
      if (!canApprove) {
        return { allowed: false, reason: 'Department Head or delegated approval authority is required.' };
      }
      if (
        toStatus === 'approved' &&
        rules?.require_editor_review &&
        roleSlug !== 'communication_director' &&
        !['under_review', 'submitted', 'approved'].includes(fromStatus)
      ) {
        return { allowed: false, reason: 'Content must undergo editorial review prior to approval.' };
      }
      return { allowed: true };

    case 'scheduled':
    case 'published':
      if (!canPublish) {
        return { allowed: false, reason: 'Only authorized publishing personnel may publish or schedule content.' };
      }
      if (
        rules?.require_director_approval &&
        !canApprove &&
        !['approved', 'scheduled', 'published'].includes(fromStatus)
      ) {
        return { allowed: false, reason: 'Department Head approval is required before publication.' };
      }
      return { allowed: true };

    case 'archived':
      if (canPublish || canApprove) return { allowed: true };
      return { allowed: false, reason: 'Publishing or approval authority is required to archive content.' };

    default:
      return { allowed: false, reason: 'Unsupported workflow state.' };
  }
}

export const DEFAULT_ROLES: Array<{
  id: string;
  slug: string;
  name_sw: string;
  name_en: string;
  description_sw: string;
  description_en: string;
  permissions: PermissionKey[];
  is_system: boolean;
}> = [
  {
    id: 'role_super_admin',
    slug: 'super_admin',
    name_sw: 'Msimamizi Mkuu wa Mfumo',
    name_en: 'Super Administrator',
    description_sw: 'Mamlaka kamili ya mfumo, watumiaji, ruhusa, mipangilio, kumbukumbu za ukaguzi, nakala rudufu na maudhui yote.',
    description_en: 'Full system access: manage users, configurable permissions, settings, audit logs, backups, and all content.',
    permissions: ALL_PERMISSIONS.map((p) => p.key),
    is_system: true,
  },
  {
    id: 'role_comm_director',
    slug: 'communication_director',
    name_sw: 'Mkurugenzi / Mkuu wa Idara ya Mawasiliano',
    name_en: 'Communication Director / Department Head',
    description_sw: 'Kuhakiki maudhui, kuidhinisha au kukataa machapisho na matangazo, kuchapisha na kusimamia maudhui yote ya idara.',
    description_en: 'Review content, approve or reject publications and announcements, publish, and oversee all department content.',
    permissions: [
      'dashboard.view',
      'analytics.view',
      'compliance.view',
      'content.view',
      'content.create',
      'content.edit_own',
      'content.edit_any',
      'content.review',
      'content.approve',
      'content.publish',
      'content.delete',
      'publications.view',
      'publications.manage',
      'publications.approve',
      'events.view',
      'events.manage',
      'events.publish',
      'profiles.view',
      'profiles.manage',
      'services.manage',
      'faq.manage',
      'media.view',
      'media.upload',
      'media.manage',
      'pages.view',
      'pages.manage',
      'pages.publish',
      'taxonomy.manage',
      'enquiries.view',
      'enquiries.manage',
      'testimonials.moderate',
      'audit.view',
    ],
    is_system: true,
  },
  {
    id: 'role_editor',
    slug: 'editor',
    name_sw: 'Mhariri',
    name_en: 'Editor',
    description_sw: 'Kuandaa na kuhariri maudhui, kuhakiki makala zilizowasilishwa, kuomba marekebisho na kuwasilisha kwa uidhinishaji.',
    description_en: 'Create and edit content, review submitted articles, request revisions, and forward content for approval.',
    permissions: [
      'dashboard.view',
      'analytics.view',
      'content.view',
      'content.create',
      'content.edit_own',
      'content.edit_any',
      'content.review',
      'publications.view',
      'events.view',
      'events.manage',
      'profiles.view',
      'profiles.manage',
      'services.manage',
      'faq.manage',
      'media.view',
      'media.upload',
      'media.manage',
      'pages.view',
      'pages.manage',
      'taxonomy.manage',
      'enquiries.view',
      'testimonials.moderate',
    ],
    is_system: true,
  },
  {
    id: 'role_contributor',
    slug: 'contributor',
    name_sw: 'Mwandishi wa Habari / Mchangiaji Maudhui',
    name_en: 'Journalist / Content Contributor',
    description_sw: 'Kuwasilisha makala na habari, kupakia picha zilizoidhinishwa, kuhariri rasimu zake na kufuatilia mawasilisho yake.',
    description_en: 'Submit articles, upload approved media, edit own drafts, and track own submissions.',
    permissions: [
      'dashboard.view',
      'content.view',
      'content.create',
      'content.edit_own',
      'media.view',
      'media.upload',
    ],
    is_system: true,
  },
  {
    id: 'role_publications_officer',
    slug: 'publications_officer',
    name_sw: 'Afisa Machapisho na Nyaraka',
    name_en: 'Publications Officer',
    description_sw: 'Kusimamia nyaraka, ripoti za taasisi, majarida ya Bango, sera, taarifa kwa vyombo vya habari na machapisho.',
    description_en: 'Manage documents, institutional reports, press releases, Bango newsletters, and corporate publications.',
    permissions: [
      'dashboard.view',
      'analytics.view',
      'publications.view',
      'publications.manage',
      'content.view',
      'content.create',
      'content.edit_own',
      'media.view',
      'media.upload',
      'media.manage',
      'taxonomy.manage',
    ],
    is_system: true,
  },
  {
    id: 'role_media_manager',
    slug: 'media_manager',
    name_sw: 'Meneja wa Picha, Video na Maktaba',
    name_en: 'Media and Gallery Manager',
    description_sw: 'Kusimamia picha, video, maelezo ya picha, maandishi mbadala na maktaba za picha za shirika.',
    description_en: 'Manage photographs, videos, captions, alternative text, and corporate media galleries.',
    permissions: [
      'dashboard.view',
      'media.view',
      'media.upload',
      'media.manage',
      'media.delete',
      'events.view',
      'content.view',
    ],
    is_system: true,
  },
  {
    id: 'role_readonly_admin',
    slug: 'readonly_admin',
    name_sw: 'Msimamizi Mtazamaji Pekee',
    name_en: 'Read-only Administrator',
    description_sw: 'Kutazama dashibodi, maudhui na ripoti zinazoruhusiwa bila haki ya kuhariri au kuchapisha.',
    description_en: 'View dashboard, permitted content tables, compliance status, and analytics reports with no editing or publishing rights.',
    permissions: [
      'dashboard.view',
      'analytics.view',
      'compliance.view',
      'content.view',
      'publications.view',
      'events.view',
      'profiles.view',
      'media.view',
      'pages.view',
      'enquiries.view',
    ],
    is_system: true,
  },
];
