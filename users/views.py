from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import login, authenticate
import os
from django.conf import settings

# Create your views here.

def register(response):
    response.user
    if response.method == "POST":
        form = UserCreationForm(response.POST)
        if form.is_valid():
            form.save()

        return redirect("/")
    else:
        form = UserCreationForm()
    return render(response, 'register/register.html', {"form":form})

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                user_media_path = os.path.join(settings.MEDIA_ROOT, str(user.id))
                os.makedirs(user_media_path, exist_ok=True)
                return redirect('home')  # replace 'home' with the name of the view you want to redirect to
    else:
        form = AuthenticationForm()
    return render(request, 'registration/login.html', {'form': form})
