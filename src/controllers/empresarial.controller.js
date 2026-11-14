
const empresarialController = {

    mostrarInicio: (req, res) => {
        res.render('empresarial/index', {
            titulo: 'Módulo empresarial',
            descripcion: 'Gestiona tu empresa, publica empleos y administra postulaciones.'
        });
    }

};

module.exports = empresarialController;
