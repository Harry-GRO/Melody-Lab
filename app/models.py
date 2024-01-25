from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.template import defaultfilters

def validate_file_size(value):
    max_size = 50 * 1024 * 1024  # 50 MB (adjust first number if needed)

    if value.size > max_size:
        raise ValidationError(_('File size must be no more than %(max_size)s. Current file size is %(current_size)s.') % {
            'max_size': defaultfilters.filesizeformat(max_size),
            'current_size': defaultfilters.filesizeformat(value.size),
        })

def validate_audio_or_video_file(value):
    allowed_types = ['audio/', 'application/ogg', 'audio/mp4', 'audio/webm', 'application/x-flac']
    content_type = value.file.content_type
    if not any(content_type.startswith(prefix) for prefix in allowed_types):
        raise ValidationError('Invalid file type. Only audio files are allowed.')

class Upload(models.Model):
    file_field = models.FileField(upload_to='', validators=[validate_file_size, validate_audio_or_video_file])


        




