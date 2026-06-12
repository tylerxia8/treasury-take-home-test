// Run async tasks with a bounded concurrency limit. Used for batch verification
// so a 300-label upload doesn't fire 300 simultaneous API calls (and trip rate
// limits), while still keeping wall-clock time low through parallelism.

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = new Array(Math.min(Math.max(1, limit), items.length || 1))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) break;
        results[i] = await worker(items[i], i);
      }
    });

  await Promise.all(runners);
  return results;
}
