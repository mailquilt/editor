# Three Modes and a Selection bar instead of a side panel

The editor has three Modes, Edit, Style and Check, each with one job: change the email, set how the whole email looks, and see it in an inbox with its Problems before exporting. In Edit, the selected Block's or Row's settings and actions are in one Selection bar above the Canvas, the Rows list is beside it, and there's no side panel. Check takes the place of the Preview dialog.

Until now one side panel did three jobs: it listed Blocks and Rows to add, showed the email's settings, and swapped both for the selected Block's or Row's settings. Adding something meant going back to a tab first, the email's settings were one tab among many, and nothing told a person what would go wrong for readers until they opened Preview and looked. A side panel also keeps about 320px of a host's page all the time, inside apps that often have a sidebar of their own.

## Considered options

- **Keep the side panel and restyle it.** Mocked up first and judged average next to competitors: it moved today's pieces around without changing what a person has to do.
- **One screen with everything in it**, a panel with Settings, Style and Problems tabs. It keeps everything in view but crowds it, as competitors' panels are.
- **Floating settings beside the selection.** It gives the email the most room, but on a laptop the card covers the email and moves with every selection.

## Consequences

- Every Block's settings have to fit the Selection bar. Today's Blocks have at most five, and settings that belong to the whole email move to Email style. A future Block with more opens a larger panel from the bar's "More" button rather than growing the bar.
- Tab from the selected Block reaches the Selection bar, one stop with arrow keys between its buttons, as the toolbars are today. This changes where ADR 0020's Tab path ends.
- Below 640px the editor works, with the Selection bar docked at the bottom and sheets for adding and the Selection bar's panels, and Style and Check at the bottom under the email, instead of the narrow notice.
- Hosts that build their own page around `<mail-quilt>` get the Modes too. The Shell adds the email's name, its save status, Export and its messages to the same top bar.
