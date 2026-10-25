import type { Role, SubmissionStatus } from "./types";

const transitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  SUBMITTED: ["RETURNED_FOR_CORRECTION", "SCREENING_DECLINED", "ELIGIBLE_FOR_REVIEW"],
  RETURNED_FOR_CORRECTION: ["SUBMITTED", "SCREENING_DECLINED"],
  SCREENING_DECLINED: [],
  ELIGIBLE_FOR_REVIEW: ["UNDER_REVIEW", "RETURNED_FOR_CORRECTION", "SCREENING_DECLINED"],
  UNDER_REVIEW: ["REVISION_REQUESTED", "ACCEPTED", "REJECTED"],
  REVISION_REQUESTED: ["SUBMITTED"],
  ACCEPTED: [],
  REJECTED: [],
};

export function canTransition(from: SubmissionStatus, to: SubmissionStatus, role: Role) {
  if (role === "RESEARCHER") return (from === "RETURNED_FOR_CORRECTION" || from === "REVISION_REQUESTED") && to === "SUBMITTED";
  return role === "COORDINATOR" && transitions[from].includes(to);
}

export function assertTransition(from: SubmissionStatus, to: SubmissionStatus, role: Role) {
  if (!canTransition(from, to, role)) throw new Error("This workflow transition is not permitted.");
}
