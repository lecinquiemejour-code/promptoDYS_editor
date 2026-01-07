// Convertisseur HTML ↔ Markdown pour l'éditeur

/**
 * Normalise le HTML en enveloppant le texte orphelin (sans balises) dans des <div>
 * Corrige le bug où la première ligne tapée n'a pas de <div> et fusionne avec la suivante
 * @param {string} html - Le contenu HTML brut
 * @returns {string} - Le contenu HTML normalisé
 */
const normalizeOrphanText = (html) => {
  // Créer un div temporaire pour parser le HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Parcourir tous les nœuds enfants directs
  const normalizedNodes = [];

  tempDiv.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // C'est du texte brut orphelin (comme "salut" sans <div>)
      const text = node.textContent.trim();
      if (text) {
        console.log('🔧 [normalizeOrphanText] Texte orphelin détecté:', text);
        normalizedNodes.push(`<div>${text}</div>`);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // C'est déjà une balise HTML, garder tel quel
      normalizedNodes.push(node.outerHTML);
    }
  });

  const normalized = normalizedNodes.join('');
  console.log('✅ [normalizeOrphanText] HTML normalisé:', normalized);
  return normalized;
};

/**
 * Convertit du HTML en Markdown
 * @param {string} html - Le contenu HTML à convertir
 * @returns {string} - Le contenu Markdown
 */
export const htmlToMarkdown = (html) => {
  if (!html) return '';

  // 🆕 Normaliser le HTML pour envelopper le texte orphelin dans des <div>
  console.log('🔍 [htmlToMarkdown] HTML avant normalisation:', html);
  html = normalizeOrphanText(html);
  console.log('✅ [htmlToMarkdown] HTML après normalisation:', html);

  // Fonction pour normaliser les couleurs RGB vers hex
  const rgbToHex = (rgb) => {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgb;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  // Préserver les spans colorés en les marquant temporairement ET normaliser les couleurs
  const colorSpanMarkers = [];
  let tempHtml = html.replace(/<span[^>]*style="[^"]*color:[^"]*"[^>]*>.*?<\/span>/gis, (match) => {
    // Normaliser rgb() vers hex dans le span
    const normalizedMatch = match.replace(/color:\s*rgb\([^)]+\)/gi, (colorMatch) => {
      const hexColor = rgbToHex(colorMatch.replace('color:', '').trim());
      return `color: ${hexColor}`;
    });

    const marker = `__COLOR_SPAN_${colorSpanMarkers.length}__`;
    colorSpanMarkers.push(normalizedMatch);
    return marker;
  });

  let markdown = tempHtml
    // Décoder les entités HTML AVANT tout traitement
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

    // Nettoyer le HTML d'abord
    .replace(/\n\s*\n/g, '\n') // Supprimer les lignes vides multiples
    .replace(/^\s+|\s+$/g, '') // Trim

    // Titres H1-H6
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')

    // Images - préserver width, height et data-image-id comme attributs HTML
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*(width="[^"]*"|height="[^"]*"|data-image-id="[^"]*")[^>]*\/?>/gi, (match, src, alt) => {
      const widthMatch = match.match(/width="([^"]*)"/i);
      const heightMatch = match.match(/height="([^"]*)"/i);
      const imageIdMatch = match.match(/data-image-id="([^"]*)"/i);
      let result = `![${alt}](${src})`;

      const attrs = [];
      if (widthMatch) attrs.push(`width=${widthMatch[1]}`);
      if (heightMatch) attrs.push(`height=${heightMatch[1]}`);
      if (imageIdMatch) attrs.push(`id=${imageIdMatch[1]}`);

      if (attrs.length > 0) {
        result += `{${attrs.join(' ')}}`;
      }
      return result;
    })
    .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*(width="[^"]*"|height="[^"]*"|data-image-id="[^"]*")[^>]*\/?>/gi, (match, alt, src) => {
      const widthMatch = match.match(/width="([^"]*)"/i);
      const heightMatch = match.match(/height="([^"]*)"/i);
      const imageIdMatch = match.match(/data-image-id="([^"]*)"/i);
      let result = `![${alt}](${src})`;

      const attrs = [];
      if (widthMatch) attrs.push(`width=${widthMatch[1]}`);
      if (heightMatch) attrs.push(`height=${heightMatch[1]}`);
      if (imageIdMatch) attrs.push(`id=${imageIdMatch[1]}`);

      if (attrs.length > 0) {
        result += `{${attrs.join(' ')}}`;
      }
      return result;
    })
    .replace(/<img[^>]*src="([^"]*)"[^>]*(width="[^"]*"|height="[^"]*"|data-image-id="[^"]*")[^>]*\/?>/gi, (match, src) => {
      const widthMatch = match.match(/width="([^"]*)"/i);
      const heightMatch = match.match(/height="([^"]*)"/i);
      const imageIdMatch = match.match(/data-image-id="([^"]*)"/i);
      let result = `![](${src})`;

      const attrs = [];
      if (widthMatch) attrs.push(`width=${widthMatch[1]}`);
      if (heightMatch) attrs.push(`height=${heightMatch[1]}`);
      if (imageIdMatch) attrs.push(`id=${imageIdMatch[1]}`);

      if (attrs.length > 0) {
        result += `{${attrs.join(' ')}}`;
      }
      return result;
    })
    // Images sans dimensions (fallback)
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')

    // Formatage gras et italique
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')

    // Paragraphes - vrais blocs avec double saut de ligne
    .replace(/<p[^>]*>(.*?)<\/p>/gi, (match, content) => {
      const trimmed = content.trim();
      return trimmed ? `${trimmed}\n\n` : '';
    })

    // Divs génériques - lignes simples
    .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')

    // Sauts de ligne
    .replace(/<br\s*\/?>/gi, '\n')

    // Traiter les listes dans l'ordre de priorité : OL alphabétiques -> OL numériques -> UL puces

    // 1. Listes alphabétiques (OL avec style lower-alpha) - DÉTECTION AMÉLIORÉE
    .replace(/<ol[^>]*(?:style="[^"]*list-style-type:\s*lower-alpha[^"]*"|style="[^"]*lower-alpha[^"]*")[^>]*>(.*?)<\/ol>/gis, (match, content) => {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
      const startMatch = match.match(/start="(\d+)"/);
      const startIndex = startMatch ? parseInt(startMatch[1]) - 1 : 0;

      return items.map((item, index) => {
        const text = item.replace(/<li[^>]*>(.*?)<\/li>/gis, '$1').trim();
        const letter = String.fromCharCode(97 + startIndex + index);
        return `${letter}. ${text}`;
      }).join('\n') + '\n';
    })

    // 2. Listes numérotées (OL sans style lower-alpha) - REGEX RENFORCÉE
    .replace(/<ol(?![^>]*(?:style="[^"]*list-style-type:\s*lower-alpha|style="[^"]*lower-alpha))[^>]*>(.*?)<\/ol>/gis, (match, content) => {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
      const startMatch = match.match(/start="(\d+)"/);
      const startNumber = startMatch ? parseInt(startMatch[1]) : 1;

      return items.map((item, index) => {
        const text = item.replace(/<li[^>]*>(.*?)<\/li>/gis, '$1').trim();
        return `${startNumber + index}. ${text}`;
      }).join('\n') + '\n';
    })

    // 3. Listes à puces (UL) - NETTOYAGE DES BALISES INTERNES
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
      return items.map(item => {
        const text = item.replace(/<li[^>]*>(.*?)<\/li>/gis, '$1')
          .replace(/<[^>]+>/g, '') // Supprimer toutes les balises internes
          .trim();
        return `- ${text}`;
      }).join('\n') + '\n';
    })

    // Restaurer les spans colorés
    .replace(/__COLOR_SPAN_(\d+)__/g, (match, index) => {
      return colorSpanMarkers[parseInt(index)] || '';
    })

    // Supprimer toutes les autres balises HTML SAUF les spans colorés
    .replace(/<(?!span\s+style="[^"]*color:|\/span>)[^>]+>/gi, '')

    // Nettoyer les espaces multiples
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')

    // Normaliser les sauts de ligne sans détruire la structure
    .replace(/\n{3,}/g, '\n\n') // Maximum 2 sauts consécutifs

    .trim();

  return markdown;
};

/**
 * Convertit du Markdown en HTML
 * @param {string} markdown - Le contenu Markdown à convertir
 * @returns {string} - Le contenu HTML
 */
export const markdownToHtml = (markdown) => {
  if (!markdown) return '';

  // Préserver les spans HTML existants dans le Markdown
  const spanMarkers = [];
  let tempMarkdown = markdown.replace(/<span[^>]*style="[^"]*color:[^"]*"[^>]*>.*?<\/span>/gis, (match) => {
    const marker = `__SPAN_PRESERVE_${spanMarkers.length}__`;
    spanMarkers.push(match);
    return marker;
  });

  let html = tempMarkdown
    // Échapper les caractères HTML spéciaux SAUF pour les spans préservés
    .replace(/&(?!__SPAN_PRESERVE_)/g, '&amp;')
    .replace(/<(?!__SPAN_PRESERVE_)/g, '&lt;')
    .replace(/>(?!__SPAN_PRESERVE_)/g, '&gt;')

    // Titres H1-H6
    .replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')

    // Images - traiter AVANT les autres conversions pour éviter les conflits
    .replace(/!\[([^\]]*)\]\(([^)]+)\)\{([^}]+)\}/g, (match, alt, src, attributes) => {
      let imgTag = `<img src="${src}" alt="${alt}"`;

      // Parser les attributs width=X height=Y id=Z
      const widthMatch = attributes.match(/width=([\w%]+)/);
      const heightMatch = attributes.match(/height=([\w%]+)/);
      const idMatch = attributes.match(/id=([a-f0-9-]+)/);

      if (widthMatch) {
        imgTag += ` width="${widthMatch[1]}"`;
      }
      if (heightMatch) {
        imgTag += ` height="${heightMatch[1]}"`;
      }
      if (idMatch) {
        imgTag += ` data-image-id="${idMatch[1]}"`;
      }

      imgTag += ' style="max-width: 100%; height: auto; display: block;" />';

      // Envelopper dans un paragraphe conteneur comme dans Toolbar.js
      return `<p class="image-line" style="display: block; margin: 1em 0; text-align: left;">${imgTag}</p>`;
    })
    // Images sans dimensions (fallback)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<p class="image-line" style="display: block; margin: 1em 0; text-align: left;"><img src="$2" alt="$1" style="max-width: 100%; height: auto; display: block;" /></p>')

    // Formatage gras et italique
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')

    // TRAITER LES LISTES AVANT LA CONVERSION \n -> <br>

    // Listes à puces
    .replace(/^(\s*)-\s+(.+)$/gm, '<li data-type="bullet">$2</li>')

    // Listes numérotées - préserver le numéro original
    .replace(/^(\s*)(\d+)\.\s+(.+)$/gm, '<li data-type="number" data-number="$2">$3</li>')

    // Listes alphabétiques - préserver la lettre originale
    .replace(/^(\s*)([a-z])\.\s+(.+)$/gm, '<li data-type="letter" data-letter="$2">$3</li>')

    // Regrouper les éléments de liste consécutifs PAR TYPE HOMOGÈNE
    .replace(/(<li[^>]*data-type="[^"]*"[^>]*>.*?<\/li>\n?)+/gs, (match) => {
      const items = match.match(/<li[^>]*data-type="[^"]*"[^>]*>.*?<\/li>/gs) || [];
      const groups = [];
      let currentGroup = [];
      let currentType = null;

      // Séparer par type homogène
      for (const item of items) {
        const typeMatch = item.match(/data-type="([^"]*)"/);
        const itemType = typeMatch ? typeMatch[1] : null;

        if (itemType !== currentType) {
          // Nouveau type détecté - finaliser le groupe précédent
          if (currentGroup.length > 0) {
            groups.push({ type: currentType, items: currentGroup });
          }
          currentGroup = [item];
          currentType = itemType;
        } else {
          // Même type - ajouter au groupe actuel
          currentGroup.push(item);
        }
      }

      // Finaliser le dernier groupe
      if (currentGroup.length > 0) {
        groups.push({ type: currentType, items: currentGroup });
      }

      // Convertir chaque groupe en HTML approprié
      return groups.map(group => {
        const { type, items } = group;

        if (type === 'letter') {
          // Listes alphabétiques
          const firstLetterMatch = items[0].match(/data-letter="([a-z])"/);
          const startLetter = firstLetterMatch ? firstLetterMatch[1] : 'a';
          const startIndex = startLetter.charCodeAt(0) - 97; // a=0, b=1, c=2...
          const cleanItems = items.map(item => item.replace(/ data-type="[^"]*"| data-letter="[^"]*"/g, ''));

          if (startIndex > 0) {
            return `<ol style="list-style-type: lower-alpha; padding-left: 2.5em;" start="${startIndex + 1}">${cleanItems.join('')}</ol>`;
          } else {
            return `<ol style="list-style-type: lower-alpha; padding-left: 2.5em;">${cleanItems.join('')}</ol>`;
          }
        } else if (type === 'number') {
          // Listes numérotées
          const firstNumberMatch = items[0].match(/data-number="(\d+)"/);
          const startNumber = firstNumberMatch ? parseInt(firstNumberMatch[1]) : 1;
          const cleanItems = items.map(item => item.replace(/ data-type="[^"]*"| data-number="[^"]*"/g, ''));

          if (startNumber > 1) {
            return `<ol style="padding-left: 2.5em;" start="${startNumber}">${cleanItems.join('')}</ol>`;
          } else {
            return `<ol style="padding-left: 2.5em;">${cleanItems.join('')}</ol>`;
          }
        } else if (type === 'bullet') {
          // Listes à puces
          const cleanItems = items.map(item => item.replace(/ data-type="[^"]*"/g, ''));
          return `<ul style="padding-left: 2.5em;">${cleanItems.join('')}</ul>`;
        } else {
          // Type inconnu - retourner tel quel
          return items.join('');
        }
      }).join('\n') + '\n';
    })

    // Traiter les paragraphes par blocs séparés par double saut AVANT conversion \n → <br>
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';

      // Si c'est déjà du HTML (titres, listes), le garder tel quel SANS conversion \n → <br>
      if (block.match(/^<h[1-6]|<ul|<ol/)) return block;

      // Si le bloc contient des listes, ne pas l'envelopper dans des divs
      if (block.match(/<ul|<ol/)) return block;

      // Pour les autres blocs, convertir \n → <br> puis traiter
      const processedBlock = block.replace(/\n(?!\n)(?!$)/g, '<br>');
      const lines = processedBlock.split('<br>').map(line => line.trim()).filter(line => line);

      if (lines.length === 1) {
        // Une seule ligne → <div> (ligne simple)
        return `<div>${lines[0]}</div>`;
      } else {
        // Plusieurs lignes → <div> avec <br> pour préserver les sauts
        return `<div>${lines.join('<br>')}</div>`;
      }
    })
    .filter(block => block)
    .join('\n')

    // Restaurer les spans colorés préservés
    .replace(/__SPAN_PRESERVE_(\d+)__/g, (match, index) => {
      return spanMarkers[parseInt(index)] || '';
    })

    // Nettoyer les <br> et espaces indésirables après les balises de bloc
    .replace(/(<\/(?:ul|ol|h[1-6])>)\s*<br>/g, '$1')
    .replace(/(<\/(?:ul|ol|h[1-6])>)\s*\n/g, '$1')

    // Nettoyer les lignes vides multiples
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n+|\n+$/g, '');

  return html;
};

/**
 * Détecte si le contenu contient de la syntaxe Markdown
 * @param {string} content - Le contenu à analyser
 * @returns {boolean} - true si c'est du Markdown
 */
export const isMarkdownContent = (content) => {
  if (!content) return false;

  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Titres
    /\*\*[^*]+\*\*/,         // Gras
    /\*[^*]+\*/,             // Italique
    /^[-*]\s+/m,             // Listes à puces
    /^\d+\.\s+/m,            // Listes numérotées
    /^[a-z]\.\s+/m,          // Listes alphabétiques
    /!\[.*?\]\([^)]+\)/      // Images
  ];

  return markdownPatterns.some(pattern => pattern.test(content));
};
