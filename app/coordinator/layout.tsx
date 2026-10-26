import { Suspense } from "react";
import { WorkspaceFrame } from "@/components/site/workspace-frame";
import { WorkspaceLoading } from "@/components/site/workspace-loading";

export const instant = false;

export default function CoordinatorLayout({ children }: LayoutProps<"/coordinator">) {
  return <Suspense fallback={<WorkspaceLoading />}><WorkspaceFrame role="COORDINATOR">{children}</WorkspaceFrame></Suspense>;
}
