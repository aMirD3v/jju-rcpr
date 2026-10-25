export const roles = ["ADMIN", "COORDINATOR", "REVIEWER", "RESEARCHER"] as const;
export type Role = (typeof roles)[number];

export const callStatuses = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"] as const;
export type CallStatus = (typeof callStatuses)[number];

export const submissionStatuses = [
  "SUBMITTED",
  "RETURNED_FOR_CORRECTION",
  "SCREENING_DECLINED",
  "ELIGIBLE_FOR_REVIEW",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "ACCEPTED",
  "REJECTED",
] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const recommendations = ["ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"] as const;
export type Recommendation = (typeof recommendations)[number];

export type Actor = { id: string; role: Role };

export type WorkflowEventInput = {
  submissionId: string;
  actorId: string;
  eventType: string;
  fromStatus?: SubmissionStatus;
  toStatus?: SubmissionStatus;
  detail?: Record<string, unknown>;
};
