import React from 'react';

const StatusBar = ({ currentFormat, content, dysSettings }) => {


  const getFormatDescription = () => {
    const formats = [];
    
    // Ajouter le titre s'il existe
    if (currentFormat.heading) {
      const headingLabels = {
        'h1': 'Titre 3',
        'h2': 'Titre 2', 
        'h3': 'Titre 1'
      };
      formats.push(headingLabels[currentFormat.heading] || currentFormat.heading.toUpperCase());
    }
    
    // Ajouter le type de liste s'il existe
    if (currentFormat.list) {
      const listLabels = { 
        'bullet': 'Liste à puces', 
        'number': 'Liste numérotée', 
        'letter': 'Liste alphabétique' 
      };
      formats.push(listLabels[currentFormat.list] || 'Liste');
    }
    
    // Si ni titre ni liste, afficher "Texte"
    if (!currentFormat.heading && !currentFormat.list) {
      formats.push('Texte');
    }
    
    // Ajouter les autres formats
    if (currentFormat.bold) {
      formats.push('Gras');
    }
    
    if (currentFormat.italic) {
      formats.push('Italique');
    }
    
    return formats.join(', ');
  };

  const getDysInfo = () => {
    if (!dysSettings) return 'Standard';
    
    const fontMap = {
      'Verdana': 'Verdana',
      'Arial': 'Arial', 
      'Comic Sans MS': 'Comic Sans',
      'Lexend': 'Lexend',
      'OpenDyslexic': 'OpenDyslexic'
    };
    
    const fontName = fontMap[dysSettings.fontFamily] || dysSettings.fontFamily;
    
    return `${fontName} • ${dysSettings.fontSize}px`;
  };

  return (
    <div className="border-t bg-gray-50 px-4 py-2">
      <div className="flex items-center text-sm text-gray-700">
        <div className="flex space-x-6">
          <span>✏️ <span className="font-medium">{getDysInfo()}</span></span>
          <span>Format: <span className="font-medium">{getFormatDescription()}</span>
            <span 
              className="inline-block rounded ml-2"
              style={{ 
                backgroundColor: currentFormat.color || '#000000',
                width: '12px',
                height: '12px',
                minWidth: '12px',
                minHeight: '12px',
                border: '1px solid #ccc'
              }}
            ></span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
