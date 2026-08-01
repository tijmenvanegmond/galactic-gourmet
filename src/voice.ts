// ---------------------------------------------------------------------------
// The kaiju's name and its mouth. Names are rolled per run; lines are picked
// per event. Nothing here touches game state — callers ask for a string.
// ---------------------------------------------------------------------------

const NAMES = [
  'Abaddon', 'Gnashgar', 'Vorlax', 'Molgrim', 'Belphegor', 'Xarnoth',
  'Grendelin', 'Thraxus', 'Ozymunch', 'Baalzebrunch', 'Krunthar', 'Vermigor',
  'Sludgoth', 'Ymirgar', 'Cthulunch', 'Morgoloth', 'Skarnak', 'Fenrisch',
  'Hobblegorm', 'Drazmuth', 'Pestilex', 'Gorgamesh', 'Nyarlagoth', 'Brunhild',
];

const EPITHETS = [
  'the Consumer',
  'the Peckish',
  'the Room-Temperature',
  'the Gluten-Curious',
  'the Small-Plates Enthusiast',
  'the Perpetually Snacking',
  'the Mildly Lactose-Intolerant',
  'the Devourer of Brunch',
  'the All-You-Can-Eat',
  'the Portion-Controlled',
  'the Second Helping',
  'the Bottomless',
  'the Palate Cleanser',
  'the Table for One',
  'the Insatiable',
  'the Family Sized',
  'the Medium-Rare Enjoyer',
  'the Napkin-Tucker',
  'the Two-Star Reviewer',
  'the Chews Loudly',
  'the Free Refill',
  "the Chef's Nightmare",
  'the Unsupervised',
  'the Reservation-Holder',
];

export type BarkEvent =
  | 'arrive' | 'visit' | 'movedOn' | 'loiter' | 'spot' | 'lunge'
  | 'perfect' | 'good' | 'reject' | 'impatient' | 'devour' | 'win' | 'lose';

const LINES: Record<BarkEvent, string[]> = {
  arrive: [
    'I have crossed nine light-years and I am NOT ordering a salad.',
    'Table for one. I will be having everything.',
    'I called ahead. Nobody answered. I came anyway.',
    "I'm not angry, I'm hungry. On me those look identical.",
    'Do you know how far the nearest decent planet is? Very.',
    'I have been chewing rocks for a month. Rocks.',
  ],
  visit: [
    'Next course. What have we got.',
    'I always try the local speciality. Where is it.',
    'Nobody has greeted me. I have been here four seconds.',
    'Ooh, a little one. Is it a tasting portion?',
    'I am going to be honest, this one looks like gravel.',
    'Right, doing a lap. Purely to build an appetite.',
  ],
  movedOn: [
    'Nothing here. Moving on. Disappointed but moving on.',
    "I'll be writing about this in the review.",
    'Next.',
    'Not one waiter. Not ONE.',
    'Kitchen closed, apparently. Fine.',
  ],
  loiter: [
    "Right, I'm here. I'll wait. I am famously patient.",
    'Pulling up a chair. A big one. Made of asteroid.',
    "I'll circle. It aids the digestion I have not had yet.",
    'Take your time. Not too much of it, though.',
    'Lovely little planet. Be a shame if it were lunch.',
    "I'm going to hover here and make everyone uncomfortable.",
  ],
  spot: [
    'IS THAT FOR ME',
    'I smell butter.',
    'Something is airborne and I intend to catch it.',
    "Sir. SIR. That's mine.",
    'Appetiser inbound. I am inbound.',
    'Oh, we are doing table service. Lovely.',
  ],
  lunge: [
    'MINE',
    'NOM INBOUND',
    'OPENING WIDE',
    'GRABBING IT',
    'AAAAAA',
    'YOINK',
  ],
  perfect: [
    "Oh, that's the good stuff.",
    'Chef. CHEF. Ten out of ten.',
    'I would like this again. Immediately.',
    'Finally, someone who reads a ticket.',
    'I am going to think about this for years.',
  ],
  good: [
    'Acceptable. Barely.',
    "I've had worse. Last Tuesday.",
    'Three stars. Generous of me.',
    'It will do. It will absolutely do.',
    'Not what I ordered, but I am not a monster. I am, but not about this.',
  ],
  reject: [
    'I asked for ONE thing.',
    'This is a war crime.',
    "I'm not mad. I'm going faster, but I'm not mad.",
    'Send it back. Send the whole planet back.',
    'Zero stars. Would not orbit again.',
    'You have made me review this establishment publicly.',
  ],
  impatient: [
    'I am tapping a claw. You can hear it. Everyone can.',
    'This is the worst service in the arm of this galaxy.',
    "I'm giving you one more minute and I'm rounding down.",
    'Do I need to speak to somebody about the wait?',
    'I have started reading the menu. The menu is your planet.',
  ],
  devour: [
    "Right. I'll start with the crust.",
    'Kitchen closed. Mine is open.',
    'Earth: reportedly seventy percent soup.',
    "That's it. I'm ordering off-menu.",
  ],
  win: [
    'I am full. This is temporary. Enjoy it.',
    'You may keep the planet. For now.',
    "Compliments to the chef. I'll be back Thursday.",
    'Excellent. Do not let it go to your head.',
  ],
  lose: [
    'Delicious. The whole thing. Every bit.',
    'Ah well. Planet it is.',
    'You had five shots. FIVE.',
    'I did warn you. Loudly. Repeatedly.',
  ],
};

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export function rollName(): string {
  return `${pick(NAMES)} ${pick(EPITHETS)}`;
}

/** The part you shout in a status line, e.g. "Abaddon speeds up." */
export function shortName(name: string): string {
  return name.split(' ')[0];
}

export function bark(event: BarkEvent): string {
  return pick(LINES[event]);
}
