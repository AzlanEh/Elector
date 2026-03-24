export function unauthorized(): never {
  throw new Error("Unauthorized");
}
