import { WorkspaceRole } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { toCsv, toDownloadFilename } from "@/lib/csv";
import { db } from "@/lib/db";
import { parseDataQueryContract } from "@/lib/query-contract";
import { hasRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const session = await requireSession();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const tableId = searchParams.get("tableId");

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
    },
  });

  if (!table) {
    return new Response("Table not found", { status: 404 });
  }

  const query = parseDataQueryContract({
    q: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    sortField: searchParams.get("sortField") ?? undefined,
    page: "1",
    pageSize: "100",
  });

  const where = {
    tableId: table.id,
    ...(query.q ? { searchText: { contains: query.q } } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const orderBy =
    query.sortField === "createdAt"
      ? [{ createdAt: query.sort }, { id: query.sort }]
      : [{ updatedAt: query.sort }, { id: query.sort }];

  const records: Array<{ dataJson: unknown }> = [];
  const batchSize = 500;
  let skip = 0;

  while (true) {
    const batch = await db.record.findMany({
      where,
      orderBy,
      skip,
      take: batchSize,
      select: {
        dataJson: true,
      },
    });

    if (batch.length === 0) {
      break;
    }

    records.push(...batch);
    skip += batch.length;
  }

  const headers = table.fields.map((field) => field.name);
  const rows = records.map((record) => {
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
