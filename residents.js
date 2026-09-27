// Talking to the residents (Update 6): Clover the rabbit, the baker, and
// Mortimer the owl, the librarian. Where they are and when comes from
// RESIDENTS in world.js; how they look is in render-residents.js. Walk up
// to one and press E: their window (the same one the shopkeepers use, see
// npc.js) opens on a Chat tab with a few things to ask. What they say
// depends on the time of day, what they're doing and the weather. A
// second tab has today's request: one thing each resident would love (a
// crop, a fish, a dish...), paid for in crumbs by the house server (the
// bank), from the lists in config.js (residents.requests).
import { openNpc, npcSay, refreshNpc } from "./npc.js";
import { bank, myWallet, loadBank } from "./bank.js";
import { itemInfo, basketCount } from "./basket.js";
import { playCrumbSound } from "./audio.js";

const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

const THANKS = {
  clover: ["oh, you're a treasure! thank you thank you!", "perfect! these are perfect. i could hug you. i'm floury, so i won't.", "wonderful! come by later, there might be a spare roll with your name on it."],
  mortimer: ["most kind. most kind indeed. hoo.", "splendid. i shall note your generosity in the ledger.", "thank you. you have the makings of a fine library patron."],
};
const DONE = {
  clover: "that's all i needed today, sweetpea. ask me again tomorrow!",
  mortimer: "you've been most helpful today. tomorrow, perhaps, another small favor.",
};

// Today's request from a resident, as a row for their window: what they
// want, how many you have, and a Give button.
function requestRows(id) {
  const today = myWallet().requests?.[id];
  const want = today && CONFIG.residents.requests[id]?.[today.index];
  if (!want) return [];
  const info = itemInfo(want.item);
  const have = basketCount(want.item);
  return [
    {
      icon: info.icon,
      name: `${want.n > 1 ? want.n + " " : ""}${info.name}`,
      note: today.done ? "Done for today. A new request tomorrow!" : `You have ${have}.${have < want.n ? " (Not enough yet.)" : ""}`,
      price: want.crumbs,
      actions: today.done
        ? []
        : [
            {
              label: "Give",
              disabled: have < want.n,
              run: async () => {
                if (!(await bank("residentRequest", { id }))) return null;
                playCrumbSound();
                return pick(THANKS[id]);
              },
            },
          ],
    },
  ];
}

// What they say when you open the request tab.
function requestLine(id) {
  const today = myWallet().requests?.[id];
  const want = today && CONFIG.residents.requests[id]?.[today.index];
  if (!want) return "";
  return today.done ? DONE[id] : want.line;
}

// The hometown's time of day, in words.
function partOfDay() {
  const h = hometownHour();
  return h < 5 ? "night" : h < 11 ? "morning" : h < 16 ? "afternoon" : h < 21 ? "evening" : "night";
}

const WHO = {
  clover: {
    name: "Clover",
    icon: "🐰",
    color: "#c9574a",
    pitch: 560,
    hello: {
      morning: ["oh! good morning! mind the flour, it gets everywhere.", "morning, sweetpea! the first batch is nearly out.", "you're up early! want to watch the dough rise? it's riveting. truly."],
      afternoon: ["hello hello! just stretching my legs. ovens need a rest too.", "lovely day for a walk, isn't it? even the bread thinks so."],
      evening: ["evening! supper's on. well, it will be. eventually.", "oh, perfect timing, i need someone to tell me if this smells right."],
    },
    topics: [
      {
        name: "How's your day?",
        icon: "☀️",
        say: () => {
          if (OUTDOORS.raining) return pick(["rain's lovely for baking. the kitchen gets all cozy and the windows fog up.", "rainy days are bread days. that's a rule. i made it up, but it's a rule."]);
          if (OUTDOORS.snow > 0) return "snow! i'm making cinnamon everything. don't try to stop me.";
          return {
            morning: pick(["busy busy! three loaves in, two to go, one i forgot about. oops.", "i've been up since five. the bread doesn't knead itself. ha. knead. get it?"]),
            afternoon: pick(["i took rolls to hazel. she pretends she doesn't want them, then eats four.", "just out for some sun. the kitchen gets toasty by noon."]),
            evening: pick(["winding down. one more batch, then my feet go up.", "good! tired. flour in my ears. the usual."]),
          }[partOfDay()] ?? "sleepy. bakers go to bed early, you know.";
        },
      },
      {
        name: "What are you baking?",
        icon: "🍞",
        say: () => pick([
          "sourdough, mostly. my starter's name is doug. he's twelve years old and very moody.",
          "honey oat loaves! the honey's from the pantry. the oats are from... also the pantry.",
          "blueberry muffins, if anyone ever grows me some blueberries. hint hint.",
          "a pie. what kind? a surprise. mostly to me.",
          "cinnamon rolls. the secret is more butter. the secret is always more butter.",
        ]),
      },
      {
        name: "Any cooking tips?",
        icon: "🥄",
        say: () => pick([
          "try things in the pot! most mixes turn out wonderful. some turn out... crunchy. that's how you learn.",
          "hazel and otis both know a few family recipes. ask nicely. bring snacks.",
          "a warm meal before fishing? otis swears by it. says the fish can smell confidence.",
          "the fridge has eggs, milk, butter and cheese. that's half of baking right there.",
          "if you burn something, the raccoons will buy it. i don't ask why.",
        ]),
      },
      {
        name: "Tell me about yourself",
        icon: "🐰",
        say: () => pick([
          "i came on gus's bus one spring with a suitcase, a rolling pin and doug. the house needed a baker. i needed a house.",
          "my gran taught me to bake. she said bread is just patience you can eat.",
          "i like early mornings. it's quiet, the oven's warm, and nobody's asked me for anything yet.",
        ]),
      },
    ],
  },

  mortimer: {
    name: "Mortimer",
    icon: "🦉",
    color: "#6a4e36",
    pitch: 230,
    hello: {
      night: ["ah. a fellow night owl. welcome to the stacks.", "good evening. whisper, please. the books are thinking.", "hoo. oh, it's you. splendid. come in, come in."],
    },
    topics: [
      {
        name: "How's your night?",
        icon: "🌙",
        say: () => {
          if (OUTDOORS.raining) return "rain on the windows and a good book. i ask for nothing more. well. perhaps a biscuit.";
          const h = hometownHour();
          if (h >= 0 && h < 5) return pick(["the small hours are the best hours. everything is still, and every page is loud.", "quiet. perfectly, delightfully quiet. until you arrived. i jest. mostly."]);
          return pick(["only just woken. i'm on my first cup of tea. do be gentle.", "productive. i've reshelved the poetry. twice. someone keeps alphabetizing it by feelings."]);
        },
      },
      {
        name: "What are you reading?",
        icon: "📖",
        say: () => pick([
          "a history of spoons. volume two. volume one was frankly overrated.",
          "'the collected letters of a lighthouse keeper.' he mostly writes about fog. i find it very relatable.",
          "a mystery novel. i've guessed the ending. i'm reading on to be polite.",
          "a field guide to moths. for no particular reason. none whatsoever.",
        ]),
      },
      {
        name: "Recommend a book?",
        icon: "📚",
        say: () => pick([
          "anything with a map at the front. books with maps are never boring.",
          "try the green one on the left shelf. no, the other green one. yes, that one.",
          "i'm told friends of the house may write books for these shelves one day. i await them eagerly. and with a red pen.",
        ]),
      },
      {
        name: "Tell me about yourself",
        icon: "🦉",
        say: () => pick([
          "i've kept this library for longer than i'd care to count. owls are terrible at birthdays.",
          "i sleep on my perch through the day. do not wake me. i am, reliably, a grump before seven.",
          "sometimes, late at night, something taps on the library window. soft, like a moth. a big moth. i'm sure it's nothing.",
        ]),
      },
    ],
  },
};

// Opens a resident's window (main.js calls this when you press E by one).
export function talkToResident(id) {
  const r = RESIDENTS.find((x) => x.id === id);
  const who = WHO[id];
  const state = r && residentState(r);
  if (!who || !state) return;
  if (state.asleep) {
    openNpc({
      name: who.name,
      icon: who.icon,
      color: who.color,
      pitch: 120,
      hello: ["zzz... hoo... five more minutes... zzz", "mm... overdue... zzz...", "zzz... the dewey decimal... zzz"],
      tabs: [{ id: "asleep", label: "Shh", items: () => [], empty: "Mortimer sleeps through the day on his perch. He wakes up around 7 PM (hometown time)." }],
    });
    return;
  }
  const hello = who.hello[partOfDay()] ?? Object.values(who.hello)[0];
  openNpc({
    name: who.name,
    icon: who.icon,
    color: who.color,
    pitch: who.pitch,
    hello,
    tabs: [
      {
        id: "chat",
        label: "Chat",
        items: () =>
          who.topics.map((topic) => ({
            icon: topic.icon,
            name: topic.name,
            actions: [{ label: "Ask", soft: true, run: async () => topic.say() }],
          })),
      },
      {
        id: "request",
        label: "Today's request",
        onOpen: () => npcSay(requestLine(id)),
        items: () => requestRows(id),
        empty: "No request today.",
      },
    ],
  });
  // Today's request comes with your wallet: fetch it fresh, in case the
  // day turned over since it last came.
  loadBank().then(refreshNpc).catch(() => {});
}

// What the hint under the house says when you're next to a resident.
export function residentHint(id) {
  const r = RESIDENTS.find((x) => x.id === id);
  const state = r && residentState(r);
  if (!state) return "";
  if (state.asleep) return `${WHO[id].name} is fast asleep on his perch. Press E to peek.`;
  return `Press E to talk to ${WHO[id].name}${id === "clover" ? ", the baker" : ", the librarian"}.`;
}
