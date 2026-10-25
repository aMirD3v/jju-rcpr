import { WorkspaceFrame } from "@/components/site/workspace-frame";

export default function ResearcherLayout({ children }: LayoutProps<"/portal">) {
  return <WorkspaceFrame role="RESEARCHER">{children}</WorkspaceFrame>;
}
