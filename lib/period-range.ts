export function resolveHistoryPeriod(
  period: string | null,
  startDate: string | null,
  endDate: string | null,
  specificDate: string | null,
) {
  if (specificDate) {
    const from = new Date(specificDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(specificDate);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (start && end) {
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }

  const now = new Date();
  switch (period) {
    case "day": {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    case "week": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    case "month": {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 1);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    case "year": {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    default:
      return { from: null, to: null };
  }
}
