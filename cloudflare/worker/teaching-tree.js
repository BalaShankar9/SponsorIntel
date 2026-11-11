// Preserve document order and every matching node, including nested matches.
// A single result array avoids copying each subtree's results at every ancestor.
// Only children are followed: htmlparser2's parent/sibling links are not a tree.
export function findTeachingNodes(root, predicate) {
  const result = [], pending = [root];
  while (pending.length) {
    const node = pending.pop();
    if (predicate(node)) result.push(node);
    const children = node.children;
    if (children) {
      for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
    }
  }
  return result;
}
