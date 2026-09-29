# TODOs


## features

### parser

* [x] allow experimental *cmavo* (e.g. *ue'i*)

### web UX

* [x] replace the raw `$x_1$` placeholders with a prettier version (e.g. "<i>x<sub>1</sub></i>")

* [x] on pageload, verify whether all the 3rd-party tools we need are responsive

* [x] link from each term to the entry on *la lensisku*

* [x] show the "nesting" of how words are associated
    * see for example [jboski](https://jboski.lojban.org/?text=mi%20gubysku%20lenu%20finti%20be%20lo%20lojbau%20zei%20gentufa) or the "boxes" view of [ilmentufa](https://lojban.github.io/ilmentufa/glosser/glosser.htm#mi+gubysku+lenu+finti+be+lo+mi+cnino+gentufa) `~/Desktop/Screenshot 2026-09-29 at 12.03.21 PM.png`

* [ ] improve error messages (e.g. input "abc")


## ops

* [x] add linting ([Biome](../docs/architecture-decisions/004-lint-with-biome-defer-formatting.md), lint-only for now -- the formatter is deliberately off)

* [x] add hot reloading to the `dev:web` task

* [ ] look into newer version of TypeScript
