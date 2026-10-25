import { WorkspaceFrame } from "@/components/site/workspace-frame";

export default function ReviewerLayout({ children }: LayoutProps<"/reviewer">) {
  return <WorkspaceFrame role="REVIEWER">{children}</WorkspaceFrame>;
}
