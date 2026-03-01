import { Type } from "@sinclair/typebox";
import { tapeSeek, tapeRead, tapeWrite, tapeScan, tapeFork } from "./tape-tools.js";

/**
 * TypeBox Schema definitions for the 5-Tier Memory Turing Tape operations.
 * Allows the LLM to understand and invoke the introspective state machine.
 */

export const createTapeTools = (userId: string) => {
  return [
    {
      name: "tape_seek",
      description:
        "Moves the tape head to a specific 3D coordinate (X=instruction, Y=scope, Z=thread).",
      schema: Type.Object({
        x: Type.Number({ description: "The absolute X position along the instruction tape." }),
        y: Type.Number({ description: "The absolute Y position representing memory scope/depth." }),
        z: Type.Number({
          description: "The absolute Z position representing the active thread/branch.",
        }),
        scope: Type.Optional(
          Type.String({ description: "Memory scope: PUBLIC, PRIVATE, CORE. Default: PUBLIC." }),
        ),
      }),
      executor: async (args: any) => tapeSeek(userId, args),
    },
    {
      name: "tape_read",
      description: "Reads the symbol/context at the current tape head position.",
      schema: Type.Object({
        scope: Type.Optional(
          Type.String({ description: "Memory scope to read from. Default: PUBLIC." }),
        ),
      }),
      executor: async (args: any) => tapeRead(userId, args),
    },
    {
      name: "tape_write",
      description:
        "Writes a new symbol/context to the current tape head position, overwriting if necessary.",
      schema: Type.Object({
        type: Type.String({
          description: "Type of symbol being written (e.g., THOUGHT, FACT, ACTION).",
        }),
        content: Type.String({ description: "The payload/content to write." }),
        metadata: Type.Optional(Type.Any({ description: "Optional JSON metadata string." })),
        scope: Type.Optional(
          Type.String({ description: "Memory scope to write to. Default: PUBLIC." }),
        ),
      }),
      executor: async (args: any) => tapeWrite(userId, args),
    },
    {
      name: "tape_scan",
      description: "Scans the surrounding tape symbols within a specified radius around the head.",
      schema: Type.Object({
        radius: Type.Optional(
          Type.Number({ description: "Radius around the head to scan. Default is 2." }),
        ),
        scope: Type.Optional(
          Type.String({ description: "Memory scope to scan. Default: PUBLIC." }),
        ),
      }),
      executor: async (args: any) => tapeScan(userId, args),
    },
    {
      name: "tape_fork",
      description:
        "Forks the current tape state into a new thread along the Z-axis for speculative execution.",
      schema: Type.Object({
        destinationZ: Type.Number({ description: "The target Z coordinate for the new thread." }),
        scope: Type.Optional(Type.String({ description: "Memory scope. Default: PUBLIC." })),
      }),
      executor: async (args: any) => tapeFork(userId, args),
    },
  ];
};
