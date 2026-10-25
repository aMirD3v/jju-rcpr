import { WorkspaceFrame } from "@/components/site/workspace-frame";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <WorkspaceFrame role="ADMIN">{children}</WorkspaceFrame>;
}
