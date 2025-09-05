const fs = require('fs');
const path = require('path');

function inlineAssets() {
  const buildDir = path.join(__dirname, 'build');
  const htmlFile = path.join(buildDir, 'index.html');
  
  console.log('🚀 Création du build standalone...');
  
  // Lire le fichier HTML
  let html = fs.readFileSync(htmlFile, 'utf8');
  
  // Trouver et inline les fichiers CSS
  const cssMatches = html.match(/<link href="\.\/static\/css\/(.*?\.css)" rel="stylesheet">/g);
  if (cssMatches) {
    cssMatches.forEach(match => {
      const cssFileName = match.match(/href="\.\/static\/css\/(.*?\.css)"/)[1];
      const cssPath = path.join(buildDir, 'static', 'css', cssFileName);
      if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        html = html.replace(match, `<style>${cssContent}</style>`);
        console.log(`✅ CSS inliné: ${cssFileName}`);
      }
    });
  }
  
  // Trouver et inline les fichiers JS - CORRECTION pour éviter l'affichage en texte brut
  const jsMatches = html.match(/<script defer="defer" src="\.\/static\/js\/(.*?\.js)"><\/script>/g);
  if (jsMatches) {
    jsMatches.forEach(match => {
      const jsFileName = match.match(/src="\.\/static\/js\/(.*?\.js)"/)[1];
      const jsPath = path.join(buildDir, 'static', 'js', jsFileName);
      if (fs.existsSync(jsPath)) {
        let jsContent = fs.readFileSync(jsPath, 'utf8');
        
        // CORRECTION: Échapper les caractères problématiques qui peuvent casser l'HTML
        // Remplacer les </script> dans le contenu JS pour éviter la fermeture prématurée
        jsContent = jsContent.replace(/<\/script>/gi, '<\\/script>');
        
        // Remplacer la balise par le contenu inline SANS defer (pas nécessaire en inline)
        html = html.replace(match, `<script>${jsContent}</script>`);
        console.log(`✅ JS inliné: ${jsFileName}`);
      }
    });
  }
  
  // Inline le favicon
  const faviconPath = path.join(buildDir, 'favicon.png');
  if (fs.existsSync(faviconPath)) {
    const faviconBuffer = fs.readFileSync(faviconPath);
    const faviconBase64 = faviconBuffer.toString('base64');
    html = html.replace(
      /<link rel="icon" type="image\/png" href="\.\/favicon\.png"\/>/g,
      `<link rel="icon" type="image/png" href="data:image/png;base64,${faviconBase64}"/>`
    );
    console.log('✅ Favicon inliné en base64');
  }
  
  // Traiter les éventuelles images dans le contenu
  const imgMatches = html.match(/<img[^>]*src="\.\/static\/media\/(.*?)"[^>]*>/g);
  if (imgMatches) {
    imgMatches.forEach(match => {
      const imgFileName = match.match(/src="\.\/static\/media\/(.*?)"/)[1];
      const imgPath = path.join(buildDir, 'static', 'media', imgFileName);
      if (fs.existsSync(imgPath)) {
        const imgBuffer = fs.readFileSync(imgPath);
        const imgExt = path.extname(imgFileName).slice(1);
        const imgBase64 = imgBuffer.toString('base64');
        html = html.replace(
          match,
          match.replace(`./static/media/${imgFileName}`, `data:image/${imgExt};base64,${imgBase64}`)
        );
        console.log(`✅ Image inlinée: ${imgFileName}`);
      }
    });
  }
  
  // Supprimer la référence à eel.js (optionnel pour version standalone)
  html = html.replace(/<script src="\/eel\.js"><\/script>/, '<!-- eel.js removed for standalone version -->');
  
  // Écrire le fichier standalone
  const standaloneFile = path.join(buildDir, 'standalone.html');
  fs.writeFileSync(standaloneFile, html, 'utf8');
  
  const stats = fs.statSync(standaloneFile);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log(`🎉 Build standalone créé: ${standaloneFile}`);
  console.log(`📊 Taille du fichier: ${fileSizeMB} MB`);
  console.log('📝 Le fichier est maintenant complètement autonome et portable !');
}

// Vérifier que le dossier build existe
if (!fs.existsSync(path.join(__dirname, 'build'))) {
  console.error('❌ Erreur: Le dossier build n\'existe pas. Exécutez d\'abord "npm run build"');
  process.exit(1);
}

inlineAssets();
