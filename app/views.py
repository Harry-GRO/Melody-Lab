from django.shortcuts import render, redirect
from .forms import UploadForm
from django.conf import settings
from django.core.files.storage import FileSystemStorage
import os
import re
from django.contrib.auth.decorators import login_required
import glob

@login_required
def home(request):
    if request.method == 'POST':
        form = UploadForm(request.POST, request.FILES)
        if form.is_valid():
            myfile = request.FILES['file_field']
            fs = FileSystemStorage()

            #REMOVES SPECIAL CHARACTERS
            name, ext = os.path.splitext(myfile.name)
            filename = re.sub('[^0-9a-zA-Z]+', '_', name) + ext

            user_folder = os.path.join(settings.MEDIA_ROOT, str(request.user.id))

            files = glob.glob(user_folder + '/*')
            for f in files:
                os.remove(f)

            fs = FileSystemStorage(location=user_folder)
            filename = fs.save(filename, myfile)

            request.session['uploaded_file_name'] = filename

            return redirect('editor')
    else:
        form = UploadForm()

    return render(request, 'app/home.html', {'form': form})

@login_required
def about(request):
    return render(request, 'app/about.html')

@login_required
def editor(request):
    uploaded_file_name = request.session.get('uploaded_file_name', None)
    user_folder = os.path.join(settings.MEDIA_ROOT, str(request.user.id))
    user_folder = user_folder + '/'
    return render(request, 'app/editor.html', {'data': uploaded_file_name, 'user_folder': user_folder})
