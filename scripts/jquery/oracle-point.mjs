export function interiorBodyPoint(body, position) {
  if (!body) return false;
  return body.block
    ? position > body.span[0] && position < body.span[1] - 1
    : position >= body.span[0] && position < body.span[1];
}
