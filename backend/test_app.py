"""
Backend unit tests for Handwrite AI.
Tests core utilities, validation models, and configuration.
"""
import os
import sys
import json
import pytest

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))


class TestConfig:
    """Test the config module."""

    def test_folders_exist(self):
        from config import UPLOAD_FOLDER, CACHE_FOLDER, FONT_FOLDER
        assert os.path.isdir(UPLOAD_FOLDER)
        assert os.path.isdir(CACHE_FOLDER)
        assert os.path.isdir(FONT_FOLDER)

    def test_available_fonts_not_empty(self):
        from config import AVAILABLE_FONTS
        assert len(AVAILABLE_FONTS) > 0
        # Check font structure
        for key, font in AVAILABLE_FONTS.items():
            assert "name" in font
            assert "file" in font
            assert "style" in font

    def test_allowed_extensions(self):
        from config import ALLOWED_EXTENSIONS
        assert ".png" in ALLOWED_EXTENSIONS
        assert ".jpg" in ALLOWED_EXTENSIONS
        assert ".jpeg" in ALLOWED_EXTENSIONS


class TestValidators:
    """Test Pydantic validation models."""

    def test_generate_request_valid(self):
        from models.validators import GenerateRequest
        req = GenerateRequest(text="Hello World", fontId="caveat")
        assert req.text == "Hello World"
        assert req.fontId == "caveat"

    def test_generate_request_empty_text_fails(self):
        from models.validators import GenerateRequest
        with pytest.raises(Exception):
            GenerateRequest(text="   ")

    def test_generate_request_too_long_fails(self):
        from models.validators import GenerateRequest
        with pytest.raises(Exception):
            GenerateRequest(text="x" * 50001)

    def test_preview_request_defaults(self):
        from models.validators import PreviewRequest
        req = PreviewRequest()
        assert req.fontId == "indie_flower"
        assert req.fontSize == 60
        assert req.color == "#1a1a1a"
        assert req.wordSpacing == 8

    def test_preview_request_bad_font_size(self):
        from models.validators import PreviewRequest
        with pytest.raises(Exception):
            PreviewRequest(fontSize=500)  # ge=8, le=200

    def test_ai_writer_request_valid(self):
        from models.validators import AIWriterRequest
        req = AIWriterRequest(prompt="Write about animals")
        assert req.prompt == "Write about animals"

    def test_ai_writer_request_empty_fails(self):
        from models.validators import AIWriterRequest
        with pytest.raises(Exception):
            AIWriterRequest(prompt="   ")

    def test_cache_save_request_valid(self):
        from models.validators import CacheSaveRequest
        req = CacheSaveRequest(sessionId="abc12345", pages=[{"page": 1}])
        assert req.sessionId == "abc12345"

    def test_cache_save_request_bad_session_id(self):
        from models.validators import CacheSaveRequest
        with pytest.raises(Exception):
            CacheSaveRequest(sessionId="ab", pages=[{"page": 1}])  # too short

    def test_cache_save_request_bad_chars(self):
        from models.validators import CacheSaveRequest
        with pytest.raises(Exception):
            CacheSaveRequest(sessionId="abc!@#$%", pages=[{"page": 1}])


class TestHexToRgb:
    """Test the hex_to_rgb utility function."""

    @pytest.fixture(autouse=True)
    def skip_if_no_cv2(self):
        try:
            import cv2
        except ImportError:
            pytest.skip("cv2 not installed")

    def test_basic_colors(self):
        from handwriting_generator import hex_to_rgb
        assert hex_to_rgb("#000000") == (0, 0, 0)
        assert hex_to_rgb("#ffffff") == (255, 255, 255)
        assert hex_to_rgb("#ff0000") == (255, 0, 0)
        assert hex_to_rgb("#00ff00") == (0, 255, 0)
        assert hex_to_rgb("#0000ff") == (0, 0, 255)

    def test_without_hash(self):
        from handwriting_generator import hex_to_rgb
        assert hex_to_rgb("1a1a1a") == (26, 26, 26)

    def test_ink_colors(self):
        from handwriting_generator import hex_to_rgb
        assert hex_to_rgb("#1a3a7c") == (26, 58, 124)
        assert hex_to_rgb("#2563eb") == (37, 99, 235)


class TestHandwritingGeneratorCache:
    """Test the improved LRU cache with TTL."""

    @pytest.fixture(autouse=True)
    def skip_if_no_cv2(self):
        try:
            import cv2
        except ImportError:
            pytest.skip("cv2 not installed")

    def test_cache_class_attributes(self):
        from handwriting_generator import HandwritingGenerator
        assert HandwritingGenerator._MAX_CACHE == 5
        assert HandwritingGenerator._CACHE_TTL_SECONDS == 600
        assert isinstance(HandwritingGenerator._image_cache, dict)
        assert isinstance(HandwritingGenerator._cache_order, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
