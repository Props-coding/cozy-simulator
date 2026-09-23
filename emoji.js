// Emoji shortcuts for chat, like Discord: type :joy: and it becomes 😂 as
// soon as you type the closing colon. Classic faces like :) or <3 become
// emoji when you send the message (not while typing, so you can still
// type other things with colons in them).

// Discord-style names. Add more any time: "name": "emoji".
const SHORTCODES = {
  joy: "😂", rofl: "🤣", sob: "😭", cry: "😢", smile: "😊", blush: "😊", grin: "😁",
  laughing: "😆", sweat_smile: "😅", wink: "😉", heart_eyes: "😍", smiling_face_with_hearts: "🥰",
  sunglasses: "😎", thinking: "🤔", upside_down: "🙃", pleading: "🥺", pleading_face: "🥺",
  smiling_face_with_tear: "🥲", sleeping: "😴", yawning_face: "🥱", rage: "😡", angry: "😠",
  scream: "😱", flushed: "😳", skull: "💀", eyes: "👀", clown: "🤡", nerd: "🤓", shrug: "🤷",
  facepalm: "🤦", heart: "❤️", hearts: "💕", broken_heart: "💔", fire: "🔥", sparkles: "✨",
  star: "⭐", "100": "💯", tada: "🎉", thumbsup: "👍", "+1": "👍", thumbsdown: "👎", "-1": "👎",
  wave: "👋", clap: "👏", pray: "🙏", muscle: "💪", ok_hand: "👌", raised_hands: "🙌",
  coffee: "☕", tea: "🍵", pizza: "🍕", cookie: "🍪", popcorn: "🍿", cake: "🍰",
  video_game: "🎮", books: "📚", book: "📖", musical_note: "🎵", zzz: "💤", sun: "☀️",
  moon: "🌙", rain: "🌧️", cloud: "☁️", rainbow: "🌈", cat: "🐱", dog: "🐶", raccoon: "🦝",
};

// Classic text faces, turned into emoji when you send.
const EMOTICONS = [
  [":'(", "😢"], [":)", "🙂"], [":-)", "🙂"], [":D", "😃"], [":(", "🙁"], [":-(", "🙁"],
  [";)", "😉"], [":P", "😛"], [":p", "😛"], ["xD", "😆"], ["XD", "😆"], ["<3", "❤️"], [":o", "😮"], [":O", "😮"],
];

// Swaps every complete :name: we know for its emoji. Unknown names are
// left alone.
export function expandShortcodes(text) {
  return text.replace(/:([a-z0-9_+-]+):/gi, (match, name) => SHORTCODES[name.toLowerCase()] ?? match);
}

// Swaps text faces like :) for emoji, but only when they stand on their
// own (surrounded by spaces or at the start/end), so things like "a:)b"
// or a web address are left alone.
export function expandEmoticons(text) {
  let out = text;
  for (const [face, emoji] of EMOTICONS) {
    const escaped = face.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "g"), `$1${emoji}`);
  }
  return out;
}

// Called as you type in a text box: swaps finished :name: codes for emoji
// and keeps the typing cursor in the right place.
export function expandAsYouType(input) {
  const caret = input.selectionStart ?? input.value.length;
  const before = expandShortcodes(input.value.slice(0, caret));
  const after = expandShortcodes(input.value.slice(caret));
  if (before + after === input.value) return;
  input.value = before + after;
  input.setSelectionRange(before.length, before.length);
}
