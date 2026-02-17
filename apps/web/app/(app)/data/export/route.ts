import { WorkspaceRole } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { toCsv, toDownloadFilename } from "@/lib/csv";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/workspace";

export async function GET(request: Request) {
  const session = await requireSession();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const tableId = searchParams.get("tableId");
  const q = searchParams.get("q")?.trim().toLowerCase();

  if (!workspaceId || !tableId) {
    return new Response("workspaceId and tableId are required", {
      status: 400,
    });
  }

  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: session.user.id,
      },
    },
  });

  if (
    !membership ||
    !hasRole(membership.role, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.VIEWER,
    ])
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const table = await db.table.findFirst({
    where: {
      id: tableId,
      workspaceId,
    },
    include: {
      fields: {
        orderBy: {
          position: "asc",
        },
      },
      records: {
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });

  if (!table) {
    return new Response("Table not found", { status: 404 });
  }

  const filteredRecords = q
    ? table.records.filter((record) =>
        JSON.stringify(record.dataJson).toLowerCase().includes(q),
      )
    : table.records;

  const headers = table.fields.map((field) => field.name);
  const rows = filteredRecords.map((record) => {
    const rowJson = (record.dataJson ?? {}) as Record<string, unknown>;
    return headers.map((header) => rowJson[header]);
  });

  const csvContent = toCsv(headers, rows);

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${toDownloadFilename(table.name)}-export.csv"`,
    },
  });
}
