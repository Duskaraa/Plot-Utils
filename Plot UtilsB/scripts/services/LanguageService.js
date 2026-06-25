function rawMessageParts(parts) {
  const rawtext = [];
  for (const part of parts) {
    if (typeof part === "string") {
      rawtext.push({ text: part });
    } else if (part?.rawtext && Object.keys(part).length === 1) {
      rawtext.push(...part.rawtext);
    } else {
      rawtext.push(part);
    }
  }
  return rawtext;
}

function translate(key, params = []) {
  if (!params || params.length === 0) return { translate: key };

  const allScalar = params.every((v) => typeof v === "string" || typeof v === "number");
  if (allScalar) {
    return { translate: key, with: params.map(String) };
  }
  return {
    translate: key,
    with: {
      rawtext: params.map((v) =>
        typeof v === "string" || typeof v === "number" ? { text: String(v) } : v,
      ),
    },
  };
}

function raw(parts) {
  return { rawtext: rawMessageParts(parts) };
}

function resolve(message, params) {
  return typeof message === "string" ? translate(message, params) : message;
}

export const LanguageService = {
  t: translate,
  raw,
  resolve,

  text(value) {
    return { text: String(value) };
  },

  actionBar(player, message, params = []) {
    try {
      player.onScreenDisplay.setActionBar(resolve(message, params));
    } catch {}
  },

  message(player, message, params = []) {
    try {
      player.sendMessage(raw(["§e[Plot Utils]§r ", resolve(message, params)]));
    } catch {}
  },
};
