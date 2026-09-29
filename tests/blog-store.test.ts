import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blogStatusCopy, createBlogStore } from "../lib/blog-store";

const post = {
  slug: "arrays",
  title: "Arrays",
  description: "A guide",
  date: "2026-01-01",
  category: "dsa-patterns",
};

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("createBlogStore", () => {
  it("reports a load failure and loads posts on retry", async () => {
    let calls = 0;
    const blog = createBlogStore(() => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("HTTP 500"));
      return Promise.resolve([post]);
    });

    blog.subscribe(() => {});
    await flush();

    const failed = blog.getSnapshot();
    assert.equal(failed.error, "Couldn't load posts.");
    assert.equal(failed.posts.length, 0);
    const copy = blogStatusCopy(failed, 0);
    assert.equal(copy, "Couldn't load posts.");
    assert.notEqual(copy, "No posts match your filters.");

    blog.retry();
    await flush();

    assert.equal(calls, 2);
    const loaded = blog.getSnapshot();
    assert.equal(loaded.error, null);
    assert.equal(loaded.posts.length, 1);
    assert.equal(blogStatusCopy(loaded, 1), null);
  });

  it("keeps the empty filter copy when the index loads with no posts", async () => {
    const blog = createBlogStore(() => Promise.resolve([]));
    blog.subscribe(() => {});
    await flush();

    const snapshot = blog.getSnapshot();
    assert.equal(snapshot.error, null);
    assert.equal(blogStatusCopy(snapshot, 0), "No posts match your filters.");
  });
});
