/* The homepage's configuration: the only place for what exists only later. An empty value hides what it would show.
   PLACEHOLDER marks a value that still waits for a decision or a fact; nothing marked so is visible while it is empty.

   imprintEmail: the address, written as "name [at] domain" (no plain address in any file); the scripts turn it into the
                 mailto links (head, contact, imprint). Empty: those lines and buttons are hidden.
   pageUrl:      the page's absolute address, ending in "/"; makes canonical, og:url and og:image absolute.

   home:
   variant:  the look of the page: "b4" (the cobalt look with the 3D head: the watch's signal becomes the name and flows into
             SetCon, which says what the body does), "b1", "b2", "b3" (earlier heads, kept), or "a" (the first look, not developed
             further). For the preview, index.html?v=b4 (b1, b2, b3, a) overrides it.
   role:     PLACEHOLDER. Shown before the group ("<role>, Cognitive Systems Group, Reutlingen University") once it is set;
             empty: only the group.
   photo:    ""                  no picture: the name stands alone
             "placeholder"       the picture's place with the initials LS
             "assets/photo.jpg"  the photo (square or portrait, at least 600 px wide; it is cut to a circle); a missing
                                 file falls back to the initials
             For the preview, index.html?photo=none and index.html?photo=placeholder override it.
   links:    the profile buttons beside Email, in this order; an empty value hides its button.
   pubs:     per publication: page (project page), paper (PDF or publisher page), arxiv (identifier, e.g. "2611.01234":
             shows the arXiv button and completes the BibTeX), primaryClass (arXiv category for the BibTeX), code, model,
             data, video; title: where the paper's title leads (for NPC the code until the paper has an address). Code, Model and Data of SetCon and MinPair stay visible, greyed, with "soon" while empty; every
             other button without a target is hidden. page and paper of SetCon and MinPair are relative addresses: the
             project pages live in /setcon/ and /minpair/ of this site. */
window.SITE_CONFIG = {
  imprintEmail: "lennart.schiweck [at] reutlingen-university.de",
  pageUrl: "https://lschiweck.github.io/",
  home: {
    variant: "b4",
    role: "",                                    // PLACEHOLDER
    photo: "",                                   // PLACEHOLDER until the photo comes: "" or "placeholder" or "assets/photo.jpg"
    links: {
      github: "https://github.com/lschiweck",
      scholar: "",                               // PLACEHOLDER, Google Scholar profile
      linkedin: "",                              // PLACEHOLDER
      x: "",                                     // PLACEHOLDER
      orcid: "https://orcid.org/0009-0007-9337-7104"
    },
    pubs: {
      setcon:  { title: "setcon/",  page: "setcon/",  paper: "setcon/paper/setcon.pdf",   arxiv: "2611.32548", primaryClass: "cs.CV",
                code: "", model: "https://huggingface.co/lschiweck/SetCon", data: "https://huggingface.co/datasets/lschiweck/SetCon-eval" },
      minpair: { title: "minpair/", page: "minpair/", paper: "minpair/paper/minpair.pdf", arxiv: "2611.32549", primaryClass: "cs.CV",
                code: "", model: "https://huggingface.co/lschiweck/MinPair", data: "" },
      // GI VR/AR Workshop 2026 (LNI), to appear: paper stays empty until the published version has an address (PLACEHOLDER);
      // then set title to the paper too
      npc:     { title: "papers/npc_gi_vrar_2026.pdf", paper: "papers/npc_gi_vrar_2026.pdf", code: "https://github.com/lschiweck/LLM-NPC-Agents", video: "https://youtu.be/Z-WZ-Prl8bI" },
      concert: { title: "https://arxiv.org/abs/2610.35816", paper: "", arxiv: "2610.35816", primaryClass: "cs.MM" },
      flta:    { title: "https://ieeexplore.ieee.org/document/11336340/", paper: "https://ieeexplore.ieee.org/document/11336340/" },
      eccvw:   { title: "https://doi.org/10.1007/978-3-031-92591-7_17", paper: "https://doi.org/10.1007/978-3-031-92591-7_17" }
    }
  }
};
