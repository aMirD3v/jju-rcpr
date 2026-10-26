import { Suspense } from "react";
import { WorkspaceFrame } from "@/components/site/workspace-frame";
import { WorkspaceLoading } from "@/components/site/workspace-loading";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <Suspense fallback={<WorkspaceLoading />}><WorkspaceFrame role="ADMIN">{children}</WorkspaceFrame></Suspense>;
}
