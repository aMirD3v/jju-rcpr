import { Suspense } from "react";
import { WorkspaceFrame } from "@/components/site/workspace-frame";
import { WorkspaceLoading } from "@/components/site/workspace-loading";

export const instant = false;

export default function ReviewerLayout({ children }: LayoutProps<"/reviewer">) {
  return <Suspense fallback={<WorkspaceLoading />}><WorkspaceFrame role="REVIEWER">{children}</WorkspaceFrame></Suspense>;
}
