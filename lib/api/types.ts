/**
 * Shapes returned by the existing Express API, kept deliberately close to the
 * wire format. Anything the UI needs in a different shape is derived in
 * `lib/api/*.ts`, never by reaching into these objects from a component.
 */

export type Localised = { ru: string; en: string };

/* ----------------------------------- courses ----------------------------- */

export interface ApiLesson {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  duration: string;
  durationEn: string;
  videoUrl: string | null;
  weekGoal?: string;
  weekGoalEn?: string;
}

export interface ApiCourse {
  id: string;
  slug: string;
  title: string;
  titleEn: string;
  shortDescription: string;
  shortDescriptionEn: string;
  description: string;
  descriptionEn: string;
  fullDescription: string;
  fullDescriptionEn: string;
  duration: string;
  durationEn: string;
  price: number;
  priceEur: number;
  isFreeTrial: boolean;
  image: string;
  category: string;
  categoryEn: string;
  level: string;
  format: string;
  delivery: string;
  stage: string;
  tools: string[];
  toolsEn: string[];
  skills: string[];
  skillsEn: string[];
  forAudience: string[];
  forAudienceEn: string[];
  finalProject: string;
  finalProjectEn: string;
  hasHomework: boolean;
  catalogHidden: boolean;
  goals: string[];
  goalsEn: string[];
  lessons: ApiLesson[];
  contentLocked: boolean;
  availability: string;
}

/* --------------------------------- marketplace ---------------------------- */

export type LicenseId = "personal" | "client" | "agency";

export interface ApiLicense {
  id: LicenseId;
  priceEur: number;
  rights: string;
  clientLimit: number | null;
}

export interface ApiFreePreview {
  type: string;
  titleRu: string;
  titleEn: string;
  contentRu: string;
  contentEn: string;
}

export interface ApiProduct {
  id: string;
  slug: string;
  categoryId: string;
  productType: string;
  titleRu: string;
  titleEn: string;
  shortRu: string;
  shortEn: string;
  priceEur: number;
  coverGradient: string | null;
  coverIcon: string | null;
  coverImage: string | null;
  creatorId: string;
  includedRu: string[];
  includedEn: string[];
  licenses: ApiLicense[];
  fileTypes: string[];
  faqRu: { q: string; a: string }[];
  faqEn: { q: string; a: string }[];
  badges: string[];
  badge: string | null;
  relatedIds: string[];
  recommendsForCourses: string[];
  screenshots: string[];
  videoPreview: string | null;
  freePreview: ApiFreePreview | null;
  reviewCount: number;
  rating: number | null;
  availability?: string;
  outcomeRu?: string;
  outcomeEn?: string;
  setupTime?: string;
  priceModel?: string;
}

export interface ApiBundle {
  id: string;
  slug: string;
  title: string;
  priceEur: number;
  productIds: string[];
  vertical: string;
}

export interface ApiCatalog {
  enabled: boolean;
  products: ApiProduct[];
  bundles: ApiBundle[];
}

/* ------------------------------------ misc -------------------------------- */

export interface ApiReview {
  id: string;
  courseId: string;
  courseTitle: string;
  courseTitleEn: string;
  courseSlug: string;
  userName: string;
  rating: number;
  text: string;
  date: string;
  emailMasked?: string;
}

export interface ApiBlogPost {
  id: string;
  slug: string;
  title: string;
  titleEn: string;
  excerpt: string;
  excerptEn: string;
  date: string;
  category: string;
  categoryEn: string;
  body?: string;
  bodyEn?: string;
  readMinutes?: number;
}

export interface ApiForumCategory {
  id: string;
  ru: string;
  en: string;
}

export interface ApiForumTopic {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string;
  courseId: string | null;
  isPinned: boolean;
  isLocked: boolean;
  solvedPostId: string | null;
  views: number;
  replyCount: number;
  reactions: number;
  author: { id: number; name: string; role: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface ApiForumPost {
  id: string;
  topicId: string;
  body: string;
  author: { id: number; name: string; role: string | null };
  reactions: number;
  isSolution?: boolean;
  createdAt: string;
}

export interface ApiGiveaway {
  slug: string;
  status: "active" | "finished" | "draft";
  endsAt: string;
  participantCount: number;
  entered: boolean;
  enteredAt: string | null;
  telegramConnected: boolean;
  telegramUsername: string | null;
  channelSubscribed: boolean;
  shared: boolean;
  referralCount: number;
  bonusChances: number;
  chances: number;
  telegramChannel: string;
  result: { winnerName?: string; announcedAt?: string } | null;
}

export interface ApiCalendarEvent {
  id: string;
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  date: string;
  type: string;
}

export interface ApiFeatureFlags {
  marketplace: boolean;
  vault: boolean;
  peerReview: boolean;
  emailSequences: boolean;
  [key: string]: boolean;
}

/* ------------------------------------ me ---------------------------------- */

export interface ApiUser {
  id: number;
  email: string;
  name: string;
  personalId: string;
  emailVerified: boolean;
  role?: string;
  avatarUrl?: string | null;
  streakCount?: number;
  telegramConnected?: boolean;
}

export interface ApiProgress {
  courseId: string;
  completedLessons: number[];
  lastLessonIndex: number;
  updatedAt: string;
}

export interface ApiEntitlement {
  productId: string;
  license: LicenseId;
  orderId: string;
  grantedAt: string;
}

export interface ApiDownload {
  assetId: string;
  productId: string;
  productSlug: string;
  title: string;
  version: number;
  size?: number;
  updatedAt: string;
}

export interface ApiCertificate {
  id: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  fileUrl: string | null;
}

export interface ApiNotification {
  id: number;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
  href?: string;
}
