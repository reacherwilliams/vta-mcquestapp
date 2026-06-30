import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Transformers.js (+ its onnxruntime native deps) must load at runtime, not be
  // bundled — used for local, in-house question embeddings.
  serverExternalPackages: ["@huggingface/transformers"],
};

export default nextConfig;
