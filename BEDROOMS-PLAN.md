# Update 2: Bedrooms, the plan (Step 0)

Nothing in the game changes until Brandon says OK to this plan.

## What's saved today

- **On the server (yes):** your bedroom's size (Cozy or Roomy), every Nest & Nook piece you own and where you placed it (including the laptop desk and mattress), whether it's locked, your look, pets, crumbs, achievements, mail and settings. They're part of each account's cloud save, sent every 30 seconds and when you leave.
- **The catch:** the server keeps that save as one sealed bundle. It never opens it to look at bedrooms. Bedrooms only appear in the house because their owner's browser shows them to everyone, so they vanish when the owner logs off. Update 2 teaches the server to read the bedroom part, so rooms can exist while their owner is away.
- **Pets** follow you around; they aren't placed in the room. They come along with the character, so nothing to move.

## Backup (you run this, since only your PC can reach the server)

One command on your PC (PowerShell) packs up everything the server keeps and copies it to your Desktop:

```
ssh props@142.93.3.149 "sudo tar czf /var/lib/cozy-server/backups/before-bedrooms.tar.gz -C /var/lib/cozy-server --exclude=backups . && sudo cp /var/lib/cozy-server/backups/before-bedrooms.tar.gz ~/ && sudo chown props ~/before-bedrooms.tar.gz"; scp props@142.93.3.149:before-bedrooms.tar.gz $HOME\Desktop\
```

That leaves two copies: one on the server (`/var/lib/cozy-server/backups/before-bedrooms.tar.gz`) and one on your Desktop. The server also keeps its own daily copies of the last 14 days.

To restore it (only if something goes wrong):

```
ssh props@142.93.3.149 "sudo systemctl stop cozy-server && sudo tar xzf /var/lib/cozy-server/backups/before-bedrooms.tar.gz -C /var/lib/cozy-server && sudo systemctl start cozy-server"
```

## The new bedroom system

**The bedroom hallway.** The upstairs landing (where the elevator already goes) becomes the bedroom hallway. There are no stairs any more since 0.44, so the elevator is the way up. Every friend's account gets a door, even while they're offline, in the order people first made their bedroom. Doors are narrower and closer together than today's rooms, so about 8 fit; the hallway grows longer if more are needed. The Workshop stays where it is.

**Each door:** owner's nameplate, a color, a small decoration (a wreath, a star, a plant and so on), a short status note (up to about 30 characters), a light (green Open, amber Knock first, red Private), a party balloon when "party" is on, and a moon while the owner is asleep.

**Separate rooms.** Walking through a door takes you into that bedroom as its own space, away from the house, so rooms can be much bigger than today (Cozy about 8 by 8 tiles, Roomy about 12 by 9, up from 4.1 and 5.6 wide). Walking back out the door puts you in the hallway in front of it. Voice and "who hears who" work the same as rooms do now.

**Room styles.** Owners pick one: Classic (today's look), Cabin, City apartment, Beach hut. The special themes for Props (lake house), Brightness (stalker) and Kxiven (scholar) today only exist for **offices**, not bedrooms. Plan: they also become a bedroom style only those three can pick (and Lyss's cottage too, since it's in the same list). Their offices stay as they are.

**Moving existing rooms over, exactly as they are.** Every piece keeps its spot, measured from the room's top-left corner as today, so nothing moves; the rooms just gain space on the right and at the front. Your owned items, Roomy upgrade and the laptop desk come along. A locked bedroom becomes Knock first, an unlocked one becomes Open. The move happens by itself the first time each person logs in on the new build, and the old data is left in place (not deleted), so going back is possible.

**Edit Room** works inside the new rooms, with the same snapping and center guides, just on a bigger floor.

## Honest limits to decide on

1. **"Private, enforced on the server."** Walking is peer to peer (browsers talk to each other directly), so the server never sees where anyone walks. What it can enforce: a private room's contents (furniture, the sleeping owner, the journal) are only handed out to people the owner lets in, and the owner's browser never sends voice to anyone else. Friends' browsers also keep uninvited people out. Someone who tampers with their own browser could still walk into an empty-looking room with nothing to see or hear. Making walking itself server-checked would mean sending everyone's movement through the server, a much bigger change. **Plan: the practical version above.**
2. **Journal "not readable by anyone, including admins."** The only real way is to lock each entry in your own browser with a key made from your password before it's saved, so the server (and you as admin) only ever holds scrambled text. The cost: if someone forgets their password and gets a reset code, their old journal entries can't be opened any more. Changing your password normally keeps them. **Plan: do it this way.**
3. **Phone calls between floors** use the same private line as whisper, so no server is involved and it stays private. If one person is on a strict network, calls go through our relay like voice already does.

## Order of work

One step at a time, committed after each, on a branch with a draft pull request. Nothing goes live until you say so.

0. This plan and the backup.
1. Bedroom hallway and doors.
2. Separate bedrooms, styles, moving existing rooms, Edit Room.
3. Privacy (Open, Knock first, Private) and room audio (voice, lo-fi, silent), Who's here.
4. Offline sleeping.
5. Journal.
6. Phone.
