const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 10;

export type QuerySortDirection = "asc" | "desc";

export type DataQuerySortField = "updatedAt" | "createdAt";

export type DataQueryContract = {
  page: number;
  pageSize: number;
  sort: QuerySortDirection;
  sortField: DataQuerySortField;
  q: string | undefined;
  from: Date | undefined;
  to: Date | undefined;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export function parseDataQueryContract(input: {
  page?: string | undefined;
  pageSize?: string | undefined;
  sort?: string | undefined;
  sortField?: string | undefined;
  q?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}): DataQueryContract {
  const page = parsePositiveInt(input.page, 1);
  const requestedPageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(MIN_PAGE_SIZE, requestedPageSize),
  );

  const sort: QuerySortDirection = input.sort === "asc" ? "asc" : "desc";
  const sortField: DataQuerySortField =
    input.sortField === "createdAt" ? "createdAt" : "updatedAt";

  const q = input.q?.trim().toLowerCase();

  return {
    page,
    pageSize,
    sort,
    sortField,
    q: q && q.length > 0 ? q : undefined,
    from: parseDate(input.from),
    to: parseDate(input.to),
  };
}
