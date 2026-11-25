/* The page's configuration: the only place for what exists only later. An empty value hides its button.
   arxiv:        the arXiv identifier, e.g. "2611.01234"; shows the arXiv button and completes the BibTeX (eprint, archivePrefix)
   primaryClass: the arXiv category for the BibTeX, e.g. "cs.CV"; used only together with arxiv
   code, model, data: absolute addresses of the public code, model weights and data
   pageUrl:      the page's absolute address, ending in "/"; makes canonical, og:url and og:image absolute
   imprintEmail: the address in the imprint, written as "name [at] domain" (no plain address in any file); frame.js turns it
                 into a mailto link, an empty value hides the line */
window.SITE_CONFIG = {
  arxiv: "2611.32548",
  primaryClass: "cs.CV",
  code: "",
  model: "https://huggingface.co/lschiweck/SetCon",
  data: "https://huggingface.co/datasets/lschiweck/SetCon-eval",
  pageUrl: "https://lschiweck.github.io/setcon/",
  imprintEmail: "lennart.schiweck [at] reutlingen-university.de"
};
