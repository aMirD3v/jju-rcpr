import { WorkspaceFrame } from "@/components/site/workspace-frame";

export default function CoordinatorLayout({ children }: LayoutProps<"/coordinator">) {
  return <WorkspaceFrame role="COORDINATOR">{children}</WorkspaceFrame>;
}
