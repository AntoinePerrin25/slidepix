FROM gitpod/openvscode-server:1.105.1

# The base image already installs Git. SlidePix's Node extension host uses it
# for the built-in Source Control view.

USER root
RUN mkdir -p /opt/slidepix/extensions /home/workspace/decks \
    && chown -R openvscode-server:openvscode-server /opt/slidepix /home/workspace/decks

COPY slidepix-linux-arm64.vsix /opt/slidepix/slidepix.vsix
COPY entrypoint.sh /opt/slidepix/entrypoint.sh
RUN chmod 755 /opt/slidepix/entrypoint.sh \
    && chown openvscode-server:openvscode-server /opt/slidepix/slidepix.vsix /opt/slidepix/entrypoint.sh

USER openvscode-server
ENV OPENVSCODE_SERVER_ROOT="/home/.openvscode-server"
RUN "${OPENVSCODE_SERVER_ROOT}/bin/openvscode-server" \
    --extensions-dir /opt/slidepix/extensions \
    --install-extension /opt/slidepix/slidepix.vsix

EXPOSE 3000
ENTRYPOINT ["/opt/slidepix/entrypoint.sh"]
