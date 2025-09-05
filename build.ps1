# Script de build pour l'éditeur Markdown
Write-Host "🔧 Début du build..." -ForegroundColor Cyan

# Lancer le build React standard
Write-Host "🚀 Lancement du build React..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build React réussi!" -ForegroundColor Green
    
    # Copier les ressources supplémentaires
    if (Test-Path "public\favicon.png") {
        Copy-Item "public\favicon.png" "build\" -Force
        Write-Host "✓ favicon.png copié" -ForegroundColor Green
    }
    if (Test-Path "public\favicon.ico") {
        Copy-Item "public\favicon.ico" "build\" -Force  
        Write-Host "✓ favicon.ico copié" -ForegroundColor Green
    }
    
    # Afficher la taille du build
    if (Test-Path "build") {
        $buildSize = (Get-ChildItem "build" -Recurse | Measure-Object -Property Length -Sum).Sum / 1KB
        Write-Host "📊 Taille totale: $([math]::Round($buildSize, 2)) KB" -ForegroundColor Yellow
    }
    
    Write-Host "🎉 Build terminé avec succès!" -ForegroundColor Green
    Write-Host "📁 Fichiers générés dans le dossier build/" -ForegroundColor Yellow
    
} else {
    Write-Host "❌ Erreur lors du build React" -ForegroundColor Red
    exit 1
}
