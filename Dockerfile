FROM alpine:latest
ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apk update && apk add py-pip && apk add --no-cache python3-dev && pip install --upgrade pip

RUN useradd -ms /bin/bash frailtyuser
USER frailtyuser
WORKDIR /home/frailtyuser/app

COPY . .
RUN pip --no-cache-dir install -r requirements.txt

CMD ["python3", "app.py"]
