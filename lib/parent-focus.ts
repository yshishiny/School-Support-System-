/**
 * Routes that get the whole width.
 *
 * The side menu earns its place on a page that lists things: you are choosing where to go. On a page about one
 * child it competes with the thing you came to read — a parent who taps "Youssef" wants Youssef, not a column of
 * fifteen other destinations and a strip of his brothers and sisters beside him. Those pages drop the menu and
 * carry a single way back instead.
 */
const FOCUS = [/^\/parent\/trace\/[^/]+$/, /^\/parent\/prayers\/[^/]+$/];

export function isFocusRoute(path: string): boolean {
  return FOCUS.some((r) => r.test(path));
}
