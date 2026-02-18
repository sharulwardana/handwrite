#!/bin/bash

# Font Download Script for HandWrite AI
# This script downloads recommended fonts from Google Fonts

echo "📥 Downloading Handwriting Fonts..."
echo "===================================="
echo ""

# Create fonts directory if not exists
mkdir -p fonts
cd fonts

# Array of font URLs from Google Fonts GitHub
declare -A fonts=(
    ["IndieFlower-Regular.ttf"]="https://github.com/google/fonts/raw/main/ofl/indieflower/IndieFlower-Regular.ttf"
    ["DancingScript-Regular.ttf"]="https://github.com/google/fonts/raw/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf"
    ["Caveat-Regular.ttf"]="https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf"
    ["PatrickHand-Regular.ttf"]="https://github.com/google/fonts/raw/main/ofl/patrickhand/PatrickHand-Regular.ttf"
)

# Download each font
for font_name in "${!fonts[@]}"; do
    url="${fonts[$font_name]}"
    
    if [ -f "$font_name" ]; then
        echo "⏭️  $font_name already exists, skipping..."
    else
        echo "⬇️  Downloading $font_name..."
        
        if command -v wget &> /dev/null; then
            wget -q "$url" -O "$font_name"
        elif command -v curl &> /dev/null; then
            curl -sL "$url" -o "$font_name"
        else
            echo "❌ Error: Neither wget nor curl is installed"
            exit 1
        fi
        
        if [ -f "$font_name" ] && [ -s "$font_name" ]; then
            echo "✅ $font_name downloaded successfully"
        else
            echo "❌ Failed to download $font_name"
        fi
    fi
    echo ""
done

echo "===================================="
echo "✨ Font download complete!"
echo ""
echo "📋 Downloaded fonts:"
ls -lh *.ttf 2>/dev/null || echo "No fonts downloaded"
echo ""
echo "📁 Fonts location: $(pwd)"
echo ""