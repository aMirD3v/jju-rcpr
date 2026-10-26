import { Suspense } from "react";
import { WorkspaceFrame } from "@/components/site/workspace-frame";
import { WorkspaceLoading } from "@/components/site/workspace-loading";

export default function ResearcherLayout({ children }: LayoutProps<"/portal">) {
  return <Suspense fallback={<WorkspaceLoading />}><WorkspaceFrame role="RESEARCHER">{children}</WorkspaceFrame></Suspense>;
}
