from django.shortcuts import render, redirect
from .forms import UploadForm
from django.conf import settings
from django.http import JsonResponse
from django.core.files.storage import FileSystemStorage
import os
import re

def delete_file(request):
    if request.method == 'POST':
        file_path = request.POST.get('file_path')

        storage = FileSystemStorage()

        if storage.exists(file_path):
            storage.delete(file_path)
            return JsonResponse({'status': 'file deleted'})
        else:
            return JsonResponse({'status': 'file not found'})

    return redirect('home')

def home(request):
    if request.method == 'POST':
        form = UploadForm(request.POST, request.FILES)
        if form.is_valid():
            myfile = request.FILES['file_field']
            fs = FileSystemStorage()

            #REMOVES SPECIAL CHARACTERS
            name, ext = os.path.splitext(myfile.name)
            filename = re.sub('[^0-9a-zA-Z]+', '_', name) + ext
            filename = fs.save(filename, myfile)

            request.session['uploaded_file_name'] = filename

            return redirect('editor')
    else:
        form = UploadForm()

    return render(request, 'app/home.html', {'form': form})

def about(request):
    return render(request, 'app/about.html')

def editor(request):
    uploaded_file_name = request.session.get('uploaded_file_name', None)
    return render(request, 'app/editor.html', {'data': uploaded_file_name})
