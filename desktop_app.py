#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script Python minimaliste pour l'éditeur Markdown avec intégration Eel native
Retour à Eel suite aux problèmes de compatibilité PyWebView

Installation requise:
pip install eel

Usage:
python desktop_app.py
"""

import eel
import os
import threading
import time


def find_web_folder():
    """Trouve le dossier contenant index.html"""
    possible_folders = ['build', 'dist', 'public', '.']

    for folder in possible_folders:
        index_path = os.path.join(folder, 'index.html')
        if os.path.exists(index_path):
            print(f"✅ Dossier web trouvé: {folder}/")
            return folder

    print("❌ Aucun index.html trouvé dans:", possible_folders)
    return None


def get_markdown():
    """
    📖 LECTURE: Récupère le contenu Markdown actuel
    """
    try:
        content = eel.readMarkdown()()
        print(f'📖 Contenu récupéré: {len(content)} caractères')
        return content
    except Exception as e:
        print(f'❌ Erreur lecture: {e}')
        return ''


def set_markdown(markdown_content):
    """
    ✏️ ÉCRITURE: Injecte du contenu Markdown
    """
    try:
        eel.writeMarkdown(markdown_content)
        print(f'✅ Contenu injecté: {len(markdown_content)} caractères')
        return True
    except Exception as e:
        print(f'❌ Erreur écriture: {e}')
        return False


def lire_contenu():
    """Interface console pour lire le contenu"""
    print("\n📖 LECTURE du contenu actuel...")
    contenu = get_markdown()

    if contenu:
        print(f"✅ Contenu récupéré ({len(contenu)} caractères):")
        print("-" * 50)
        print(contenu)
        print("-" * 50)
    else:
        print("📝 L'éditeur est vide")


def ecrire_contenu():
    """Interface console pour écrire du contenu"""
    print("\n✏️ ÉCRITURE dans l'éditeur...")
    print("💡 Tapez votre contenu Markdown (lignes multiples autorisées)")
    print("💡 Tapez 'EOF' sur une ligne vide pour terminer")
    print("-" * 50)

    lignes = []
    while True:
        try:
            ligne = input()
            if ligne.strip().upper() == "EOF":
                break
            lignes.append(ligne)
        except KeyboardInterrupt:
            print("\n❌ Saisie annulée")
            return

    contenu = "\n".join(lignes)

    if contenu.strip():
        success = set_markdown(contenu)
        if success:
            print("✅ Contenu injecté avec succès !")
        else:
            print("❌ Erreur lors de l'injection")
    else:
        print("❌ Contenu vide, rien à injecter")


def menu_console():
    """Menu console qui s'exécute en parallèle"""
    # Attendre que l'éditeur soit prêt
    print("⏳ Attente que l'éditeur soit prêt...")
    time.sleep(5)

    print("\n" + "=" * 50)
    print("🎮 ÉDITEUR MARKDOWN - CONSOLE SIMPLE")
    print("=" * 50)

    while True:
        try:
            print(f"\n📋 Options:")
            print(f"  1 - Lire le contenu de l'éditeur")
            print(f"  2 - Écrire dans l'éditeur")
            print(f"  0 - Quitter")
            print("-" * 30)

            choix = input("🎯 Votre choix (1/2/0): ").strip()

            if choix == "1":
                lire_contenu()

            elif choix == "2":
                ecrire_contenu()

            elif choix == "0":
                print("\n👋 Fermeture...")
                os._exit(0)  # Forcer la fermeture complète

            else:
                print("❌ Choix invalide. Utilisez 1, 2 ou 0")

        except KeyboardInterrupt:
            print("\n\n👋 Au revoir !")
            os._exit(0)
        except Exception as e:
            print(f"❌ Erreur: {e}")


def main():
    """Lance l'application avec Eel"""
    print('🚀 Lancement de l\'éditeur Markdown avec Eel...')

    # Trouver le dossier web
    web_folder = find_web_folder()
    if not web_folder:
        print("💡 Placez votre build React dans le dossier 'build/'")
        return

    # Initialiser Eel
    eel.init(web_folder)

    print('🪟 Ouverture de la fenêtre native...')
    print('💡 Le menu console va démarrer dans quelques secondes')

    # Lancer le menu console dans un thread séparé
    console_thread = threading.Thread(target=menu_console, daemon=True)
    console_thread.start()

    try:
        # Lancer l'éditeur Eel (mode fenêtre native sans interface navigateur)
        eel.start('index.html',
                  mode='chrome',
                  size=(1200, 800),
                  port=8080,
                  cmdline_args=[
                      '--app=http://localhost:8080/index.html',  # Mode application
                      '--disable-web-security',                  # Désactiver sécurité web
                      '--disable-features=VizDisplayCompositor', # Optimisation
                      '--no-first-run',                          # Pas de setup initial
                      '--disable-default-apps',                  # Pas d'apps par défaut
                      '--disable-extensions',                    # Pas d'extensions
                      '--disable-plugins',                       # Pas de plugins
                      '--window-size=1200,800',                  # Taille fenêtre
                      '--window-position=100,100'                # Position fenêtre
                  ],
                  block=True)  # Mode bloquant pour garder l'app ouverte

    except Exception as e:
        print(f'❌ Erreur: {e}')
        print('💡 Vérifiez que Chrome/Chromium est installé')
        print('💡 Essai avec mode alternatif...')
        
        # Fallback avec mode chrome-app si le mode chrome échoue
        try:
            eel.start('index.html',
                      mode='chrome-app',
                      size=(1200, 800),
                      port=8080,
                      block=True)
        except Exception as e2:
            print(f'❌ Erreur fallback: {e2}')

    print("🔚 Application fermée")


if __name__ == '__main__':
    main()
