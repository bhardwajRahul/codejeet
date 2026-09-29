export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
}

export interface BlogStore {
  posts: BlogPost[];
  loading: boolean;
  error: string | null;
}

const LOAD_ERROR = "Couldn't load posts.";

export function blogStatusCopy(snapshot: BlogStore, visibleCount: number): string | null {
  if (snapshot.error) return snapshot.error;
  if (!snapshot.loading && visibleCount === 0) return "No posts match your filters.";
  return null;
}

export function createBlogStore(load: () => Promise<BlogPost[]>) {
  let store: BlogStore = { posts: [], loading: true, error: null };
  const listeners = new Set<() => void>();
  let fetchStarted = false;
  let requestGen = 0;

  function emit() {
    listeners.forEach((l) => l());
  }

  function apply(next: BlogStore) {
    if (next.posts === store.posts && next.loading === store.loading && next.error === store.error) {
      return;
    }
    store = next;
    emit();
  }

  function startFetch() {
    if (fetchStarted) return;
    fetchStarted = true;
    const gen = ++requestGen;
    apply({ posts: store.posts, loading: true, error: null });

    load()
      .then((posts) => {
        if (gen !== requestGen) return;
        store = { posts, loading: false, error: null };
        emit();
      })
      .catch(() => {
        if (gen !== requestGen) return;
        fetchStarted = false;
        store = { posts: [], loading: false, error: LOAD_ERROR };
        emit();
      });
  }

  return {
    subscribe(callback: () => void) {
      listeners.add(callback);
      startFetch();
      return () => {
        listeners.delete(callback);
      };
    },
    getSnapshot() {
      return store;
    },
    retry() {
      fetchStarted = false;
      store = { posts: store.posts, loading: true, error: null };
      emit();
      startFetch();
    },
  };
}

function loadBlogIndex(): Promise<BlogPost[]> {
  return fetch("/data/blog-index.json").then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<BlogPost[]>;
  });
}

const blogStore = createBlogStore(loadBlogIndex);

export function subscribeToBlog(callback: () => void): () => void {
  return blogStore.subscribe(callback);
}

export function getBlogSnapshot(): BlogStore {
  return blogStore.getSnapshot();
}

export function retryBlog(): void {
  blogStore.retry();
}

// ponytail: stable reference. A fresh object each call makes useSyncExternalStore loop forever.
const serverSnapshot: BlogStore = { posts: [], loading: true, error: null };
export function getBlogServerSnapshot(): BlogStore {
  return serverSnapshot;
}
