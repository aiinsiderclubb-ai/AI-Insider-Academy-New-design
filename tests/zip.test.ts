import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, zip } from "@/lib/zip";

const bytes = (text: string) => new TextEncoder().encode(text);

/** Reads an archive back through its central directory, the way an unzip tool does. */
function unzip(archive: Buffer): Record<string, string> {
  const end = archive.length - 22;
  expect(archive.readUInt32LE(end)).toBe(0x06054b50);
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const files: Record<string, string> = {};

  for (let i = 0; i < count; i += 1) {
    expect(archive.readUInt32LE(at)).toBe(0x02014b50);
    const crc = archive.readUInt32LE(at + 16);
    const packedSize = archive.readUInt32LE(at + 20);
    const size = archive.readUInt32LE(at + 24);
    const nameLength = archive.readUInt16LE(at + 28);
    const local = archive.readUInt32LE(at + 42);
    const name = archive.subarray(at + 46, at + 46 + nameLength).toString("utf8");

    expect(archive.readUInt32LE(local)).toBe(0x04034b50);
    const dataStart = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    const data = inflateRawSync(archive.subarray(dataStart, dataStart + packedSize));
    expect(data.length, name).toBe(size);
    expect(crc32(data), name).toBe(crc);

    files[name] = data.toString("utf8");
    at += 46 + nameLength;
  }
  return files;
}

describe("crc32", () => {
  it("matches the published check value", () => {
    expect(crc32(bytes("123456789"))).toBe(0xcbf43926);
  });
});

describe("zip", () => {
  it("round-trips every file, Cyrillic included", () => {
    const source = {
      "pack/README.md": "# Набор\n\nС чего начать.\n",
      "pack/table.csv": "﻿Колонка,Значение\nСтрока,=B2*2\n",
      "pack/empty.txt": "",
    };
    const archive = zip(Object.entries(source).map(([name, text]) => ({ name, data: bytes(text) })));
    expect(unzip(archive)).toEqual(source);
  });

  it("writes a valid archive with no files", () => {
    expect(unzip(zip([]))).toEqual({});
  });
});
